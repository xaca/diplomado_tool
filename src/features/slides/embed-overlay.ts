import { detectEmbed, type EmbedProvider } from '@/features/slides/embeds'

// Loading state of the embeds inside a rendered slide (M14, D40): a spinner with the service's name
// until the frame loads; after FALLBACK_MS without loading, "¿No carga?" with the fix for that
// service and "Abrir". An "↗ Abrir" chip stays on every embed. Plain DOM: the slide is an SVG
// string (viewer, presenter); the editor uses <EmbedFrame> with the same texts.

export const FALLBACK_MS = 12_000

export type EmbedTexts = {
  loading: (name: string) => string
  stuck: (provider: EmbedProvider | null) => string
  open: string
  help: string
}

export function attachEmbedOverlays(root: HTMLElement, texts: EmbedTexts) {
  const timers: ReturnType<typeof setTimeout>[] = []
  for (const frame of root.querySelectorAll<HTMLIFrameElement>(
    'iframe[data-embed]',
  )) {
    const box = frame.parentElement
    if (!box || box.querySelector('.embed-overlay')) continue
    const provider = detectEmbed(frame.src)
    box.style.position = 'relative'

    const overlay = document.createElement('div')
    overlay.className = 'embed-overlay'
    overlay.dataset.testid = 'embed-loading'
    overlay.innerHTML =
      '<span class="embed-spinner" aria-hidden="true"></span><span class="embed-label"></span>'
    overlay.querySelector('.embed-label')!.textContent = texts.loading(
      provider?.name ?? '',
    )
    overlay.setAttribute('role', 'status')

    const chip = document.createElement('a')
    chip.className = 'embed-open'
    chip.dataset.testid = 'embed-open'
    chip.href = frame.src
    chip.target = '_blank'
    chip.rel = 'noopener noreferrer'
    chip.textContent = `↗ ${texts.open}`

    box.append(overlay, chip)

    let loaded = false
    frame.addEventListener(
      'load',
      () => {
        loaded = true
        overlay.classList.add('embed-overlay--done')
        timers.push(setTimeout(() => overlay.remove(), 300))
      },
      { once: true },
    )
    timers.push(
      setTimeout(() => {
        if (loaded) return
        overlay.dataset.testid = 'embed-stuck'
        overlay.classList.add('embed-overlay--stuck')
        overlay.innerHTML = ''
        const message = document.createElement('p')
        message.textContent = texts.stuck(provider)
        const actions = document.createElement('span')
        actions.className = 'embed-actions'
        const open = chip.cloneNode(true) as HTMLAnchorElement
        open.className = 'embed-button'
        open.textContent = texts.open
        const help = document.createElement('a')
        help.className = 'embed-link'
        help.href = `/ayuda/insertar#${provider?.id ?? ''}`
        help.target = '_blank'
        help.textContent = texts.help
        actions.append(open, help)
        overlay.append(message, actions)
      }, FALLBACK_MS),
    )
  }
  return () => timers.forEach(clearTimeout)
}
