// After a deploy the old hashed files are gone: a tab still running the previous version fails to
// load the next page or the slide renderer. The fix is to reload once onto the new version.

const RELOADED_AT = 'pbl.reloadedForNewVersion'
/** A second failure this soon after reloading means it isn't a new version (offline, broken deploy) */
const RETRY_AFTER_MS = 10_000

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

/** The browser couldn't load a code file (Chrome, Firefox, Safari and Vite messages). */
export function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return CHUNK_ERROR.test(message)
}

type Deps = {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  reload?: () => void
  now?: () => number
}

function sessionStore() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** False if this tab already reloaded a moment ago, or can't remember it (no loop either way). */
export function canReloadForNewVersion({
  storage = sessionStore(),
  now = Date.now,
}: Deps = {}) {
  try {
    if (!storage) return false
    return now() - Number(storage.getItem(RELOADED_AT) ?? 0) >= RETRY_AFTER_MS
  } catch {
    return false
  }
}

/** Reloads the page once to get the new version. Returns whether it did. */
export function reloadForNewVersion(deps: Deps = {}) {
  const {
    storage = sessionStore(),
    reload = () => window.location.reload(),
    now = Date.now,
  } = deps
  if (!canReloadForNewVersion({ storage, now })) return false
  try {
    storage!.setItem(RELOADED_AT, String(now()))
  } catch {
    return false
  }
  reload()
  return true
}
