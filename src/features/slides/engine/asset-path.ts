// Excalidraw loads its fonts from this path (copied there by vite.config.ts) instead of a CDN.
// Imported before '@excalidraw/excalidraw' (ES modules run in import order).

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[]
  }
}

window.EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/'

export {}
