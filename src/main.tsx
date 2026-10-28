import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/lib/i18n'
import { App } from '@/app/App'
import { reloadForNewVersion } from '@/lib/stale-build'
import './index.css'

// A deploy removed the files this tab still asks for: reload once onto the new version
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
