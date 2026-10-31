// A short, soft chime for a new announcement (M19, D79): synthesized with Web Audio, no file.
// Browsers only allow sound after the person has interacted with the page; until then it's
// silently skipped. The "Silenciar" choice is remembered on this device.

const MUTE_KEY = 'pbl.announcements.muted'
let audio: AudioContext | null = null

export function isMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setMuted(muted: boolean) {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1')
    else localStorage.removeItem(MUTE_KEY)
  } catch {
    // private window / blocked storage: the switch still works for this visit
  }
}

export function playChime() {
  if (isMuted() || typeof AudioContext === 'undefined') return
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    const start = audio.currentTime + 0.02
    for (const [index, frequency] of [784, 1047].entries()) {
      const tone = audio.createOscillator()
      const volume = audio.createGain()
      tone.type = 'sine'
      tone.frequency.value = frequency
      const at = start + index * 0.14
      volume.gain.setValueAtTime(0.0001, at)
      volume.gain.exponentialRampToValueAtTime(0.12, at + 0.02)
      volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.5)
      tone.connect(volume).connect(audio.destination)
      tone.start(at)
      tone.stop(at + 0.55)
    }
  } catch {
    // no sound available: the badge and the window still show
  }
}
