import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { afterChoice, type GuardChoice } from '@/features/notes/unsaved'
import {
  GuardContext,
  type Guard,
  type GuardEntry,
} from '@/features/notes/unsaved-guard-context'

type Asking = {
  entries: GuardEntry[]
  resolve: (ok: boolean) => void
}

/**
 * M27 (D130): before the teacher moves to another slide, student or page with an unsaved comment,
 * ask "Guardar y continuar · Descartar · Seguir escribiendo". Also the browser's own warning when
 * closing the tab. One provider for the app; the comment boxes register themselves.
 */
export function UnsavedGuardProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const entries = useRef(new Map<string, GuardEntry>())
  const [asking, setAsking] = useState<Asking | null>(null)
  const [saving, setSaving] = useState(false)
  const pending = useRef<Asking | null>(null)

  const dirtyEntries = useCallback(
    () => [...entries.current.values()].filter((entry) => entry.dirty()),
    [],
  )

  const guard = useMemo<Guard>(() => {
    const confirm = () => {
      const dirty = dirtyEntries()
      if (dirty.length === 0) return Promise.resolve(true)
      // Already asking: this second move waits for nothing, it's simply not done
      if (pending.current) return Promise.resolve(false)
      return new Promise<boolean>((resolve) => {
        const ask = { entries: dirty, resolve }
        pending.current = ask
        setAsking(ask)
      })
    }
    return {
      register(id, entry) {
        entries.current.set(id, entry)
        return () => {
          if (entries.current.get(id) === entry) entries.current.delete(id)
        }
      },
      hasDirty: () => dirtyEntries().length > 0,
      confirm,
      run(move) {
        if (dirtyEntries().length === 0) return move()
        void confirm().then((ok) => ok && move())
      },
    }
  }, [dirtyEntries])

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (dirtyEntries().length === 0) return
      event.preventDefault()
      // Older browsers need a value to show their "¿Salir del sitio?" dialog
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirtyEntries])

  function finish(ok: boolean) {
    const ask = pending.current
    pending.current = null
    setAsking(null)
    ask?.resolve(ok)
  }

  async function answer(choice: GuardChoice) {
    const ask = pending.current
    if (!ask || saving) return
    let saved = false
    if (choice === 'save') {
      setSaving(true)
      try {
        const results = await Promise.all(ask.entries.map((e) => e.save()))
        saved = results.every(Boolean)
      } finally {
        setSaving(false)
      }
    }
    if (choice === 'discard') for (const entry of ask.entries) entry.discard()
    finish(afterChoice(choice, saved) === 'move')
  }

  const where = asking?.entries[0]?.where() ?? ''

  return (
    <GuardContext.Provider value={guard}>
      {children}
      <AlertDialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open && !saving) finish(false)
        }}
      >
        <AlertDialogContent data-testid="unsaved-comment">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unsaved.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {where ? t('unsaved.where', { where }) : t('unsaved.body')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => void answer('stay')}
            >
              {t('unsaved.keepWriting')}
            </Button>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => void answer('discard')}
            >
              {t('unsaved.discard')}
            </Button>
            <Button
              autoFocus
              disabled={saving}
              aria-busy={saving || undefined}
              onClick={() => void answer('save')}
            >
              {saving && <Loader2 className="animate-spin" />}
              {saving ? t('common.saving') : t('unsaved.saveAndGo')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GuardContext.Provider>
  )
}
