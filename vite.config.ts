import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Self-hosts Excalidraw's fonts (PLAN.md → Slides → Fonts): copies them to
 * public/excalidraw-assets (git-ignored) so slides never depend on a third-party CDN.
 */
function excalidrawAssets(): Plugin {
  const root = import.meta.dirname
  const pkg = path.join(root, 'node_modules/@excalidraw/excalidraw')
  const target = path.join(root, 'public/excalidraw-assets')
  const marker = path.join(target, '.version')
  return {
    name: 'excalidraw-assets',
    buildStart() {
      const version = JSON.parse(
        readFileSync(path.join(pkg, 'package.json'), 'utf8'),
      ).version as string
      if (existsSync(marker) && readFileSync(marker, 'utf8') === version) return
      cpSync(path.join(pkg, 'dist/prod/fonts'), path.join(target, 'fonts'), {
        recursive: true,
      })
      writeFileSync(marker, version)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [excalidrawAssets(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
