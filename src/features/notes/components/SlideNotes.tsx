import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  Lock,
  MessageCircle,
  MessageSquareText,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SaveButton } from '@/components/save/SaveButton'
import { useSaveLock } from '@/components/save/use-save-lock'
import { displayNameOf } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import {
  addNote,
  deleteNote,
  PROJECT_NOTES,
  updateNote,
  visibilityOf,
  type Note,
} from '@/features/notes/api'
import {
  clearDraft,
  draftKey,
  isDirty,
  readDraft,
  writeDraft,
} from '@/features/notes/unsaved'
import { useUnsavedGuard } from '@/features/notes/unsaved-guard-context'
import { messagesPath } from '@/features/messages/messages'
import { StageAvatar } from '@/features/stages/components/StageAvatar'
import { normalizeEmail } from '@/lib/collections'
import { formatRelative, toDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import {
  MAX_NOTE_LENGTH,
  noteTextSchema,
  type NoteVisibility,
  type TeacherProfile,
} from '@/model'
import { useAuth } from '@/providers/auth-context'

type Props = {
  boardId: string
  studentId: string
  /** null = comments on the whole project (M27) */
  slideId: string | null
  notes: Note[]
  /** The board's teacher writes; the student only reads */
  canWrite: boolean
  /** M27: who reads: the owner gets "Responder en Mensajes"; classmates see only public ones */
  viewer?: 'teacher' | 'owner' | 'classmate'
  /** M27: "en la diapositiva 3 de Laura Nataly", for "Tienes un comentario sin guardar" */
  where?: string
  /** Teachers' names and photos (board.teacherProfiles, M12) for the #DOCENTE avatar */
  teacherProfiles?: Record<string, TeacherProfile>
  className?: string
  /** Presenter (M13): Enter saves, Shift+Enter new line */
  enterToSave?: boolean
  /** M15: open the form pre-filled (after the teacher changed the slide) */
  draft?: string
  onAdded?: () => void
}

/**
 * The teacher's comments on one slide, or on the whole project (M27). Each one is private
 * (teachers + that student) or public (classmates too), the teacher's choice (D128). Renders
 * nothing for readers when there are none.
 */
export function SlideNotes({
  boardId,
  studentId,
  slideId,
  notes,
  canWrite,
  viewer = canWrite ? 'teacher' : 'owner',
  where,
  teacherProfiles,
  className,
  enterToSave = false,
  draft,
  onAdded,
}: Props) {
  const { t } = useTranslation()
  const project = slideId === null
  const target = slideId ?? PROJECT_NOTES
  const newKey = draftKey(boardId, studentId, target)
  // A draft left on this device (moved away, reloaded) opens the form again
  const [adding, setAdding] = useState(
    () => draft !== undefined || (canWrite && readDraft(newKey) !== null),
  )

  if (!canWrite && notes.length === 0) return null

  return (
    <section
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-neutral-900',
        className,
      )}
      aria-label={project ? t('comments.projectTitle') : t('notes.title')}
      data-testid={project ? 'project-comments' : 'slide-notes'}
    >
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <MessageSquareText className="size-4" />
        {project ? t('comments.projectTitle') : t('notes.title')}
        {notes.length > 0 && (
          <span className="font-normal text-neutral-500">· {notes.length}</span>
        )}
      </h3>

      {notes.map((note) => (
        <NoteItem
          key={note.id}
          boardId={boardId}
          studentId={studentId}
          target={target}
          note={note}
          canWrite={canWrite}
          viewer={viewer}
          where={where}
          photoURL={teacherProfiles?.[note.authorEmail]?.photoURL ?? null}
          enterToSave={enterToSave}
        />
      ))}

      {canWrite &&
        (adding ? (
          <NoteForm
            initial={draft}
            draftStorageKey={newKey}
            where={where}
            submitLabel={t('notes.add')}
            placeholder={
              project
                ? t('comments.projectPlaceholder')
                : t('notes.placeholder')
            }
            enterToSave={enterToSave}
            onCancel={() => {
              setAdding(false)
              onAdded?.()
            }}
            onSubmit={async (text, visibility, author) => {
              await addNote(
                boardId,
                studentId,
                slideId,
                author,
                text,
                visibility,
              )
              setAdding(false)
              onAdded?.()
            }}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setAdding(true)}
          >
            {project ? t('comments.projectNew') : t('notes.new')}
          </Button>
        ))}
    </section>
  )
}

function NoteItem({
  boardId,
  studentId,
  target,
  note,
  canWrite,
  viewer,
  where,
  photoURL,
  enterToSave,
}: {
  boardId: string
  studentId: string
  target: string
  note: Note
  canWrite: boolean
  viewer: 'teacher' | 'owner' | 'classmate'
  where?: string
  photoURL: string | null
  enterToSave: boolean
}) {
  const { t, i18n } = useTranslation()
  const key = draftKey(boardId, studentId, target, note.id)
  const [editing, setEditing] = useState(
    () => canWrite && readDraft(key) !== null,
  )
  const remove = useSaveLock()
  const visibility = visibilityOf(note)

  if (editing) {
    return (
      <NoteForm
        initial={note.text}
        initialVisibility={visibility}
        draftStorageKey={key}
        where={where}
        submitLabel={t('common.save')}
        enterToSave={enterToSave}
        onCancel={() => setEditing(false)}
        onSubmit={async (text, nextVisibility) => {
          await updateNote(boardId, studentId, note.id, text, nextVisibility)
          setEditing(false)
        }}
      />
    )
  }

  const edited =
    toDate(note.updatedAt).getTime() - toDate(note.createdAt).getTime() > 1000

  return (
    <article
      className="group rounded-lg bg-white/70 p-2 text-sm"
      data-testid="note"
      data-visibility={visibility}
    >
      <header className="mb-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <StageAvatar
          name={note.authorName}
          photoURL={photoURL}
          teacher
          size={22}
        />
        <span className="font-medium text-neutral-700">{note.authorName}</span>
        <span>
          {formatRelative(
            toDate(note.createdAt),
            i18n.resolvedLanguage ?? 'es',
          )}
          {edited && ` · ${t('notes.edited')}`}
        </span>
        {/* Who reads it, so nobody is surprised (classmates only ever get public ones) */}
        {viewer !== 'classmate' && <VisibilityBadge visibility={visibility} />}
        {canWrite && (
          <span className="ml-auto flex gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t('notes.edit')}
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t('notes.delete')}
              disabled={remove.saving}
              onClick={() =>
                void remove
                  .run(() => deleteNote(boardId, studentId, note.id))
                  .catch(() => toast.error(t('errors.generic')))
              }
            >
              <Trash2 />
            </Button>
          </span>
        )}
      </header>
      <p className="whitespace-pre-line">{note.text}</p>
      {viewer === 'owner' && (
        <Button
          variant="link"
          size="xs"
          className="mt-1 h-auto px-0"
          nativeButton={false}
          render={
            <Link
              to={messagesPath(boardId)}
              onClick={() => quoteInMessages(boardId, studentId, note.text)}
            />
          }
        >
          <MessageCircle />
          {t('comments.reply')}
        </Button>
      )}
    </article>
  )
}

function VisibilityBadge({ visibility }: { visibility: NoteVisibility }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
        visibility === 'public'
          ? 'bg-sky-100 text-sky-800'
          : 'bg-neutral-200/70 text-neutral-700',
      )}
      title={
        visibility === 'public'
          ? t('comments.publicHint')
          : t('comments.privateHint')
      }
      data-testid="note-visibility"
    >
      {visibility === 'public' ? (
        <Users className="size-3" />
      ) : (
        <Lock className="size-3" />
      )}
      {visibility === 'public' ? t('comments.public') : t('comments.private')}
    </span>
  )
}

/**
 * "Responder en Mensajes" (M27): the comment goes quoted into the student's message box. Same
 * key and storage as the composer's draft in MessageThread (M26).
 */
function quoteInMessages(boardId: string, studentId: string, text: string) {
  const key = `pbl.messages.draft.${boardId}.${studentId}`
  const quote = text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
  try {
    const current = localStorage.getItem(key) ?? ''
    if (!current.includes(quote))
      localStorage.setItem(key, `${quote}\n\n${current}`.slice(0, 1000))
  } catch {
    // no storage: the conversation opens without the quote
  }
}

function NoteForm({
  initial = '',
  initialVisibility = 'private',
  draftStorageKey,
  where,
  submitLabel,
  placeholder,
  onSubmit,
  onCancel,
  enterToSave = false,
}: {
  initial?: string
  initialVisibility?: NoteVisibility
  draftStorageKey: string
  where?: string
  submitLabel: string
  placeholder?: string
  enterToSave?: boolean
  onSubmit: (
    text: string,
    visibility: NoteVisibility,
    author: { email: string; name: string },
  ) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const profile = useProfile()
  const guard = useUnsavedGuard()
  const lock = useSaveLock()
  const id = useId()
  // A draft kept on this device wins over the saved text (M27, D130)
  const [stored] = useState(() => readDraft(draftStorageKey))
  const [text, setText] = useState(stored ?? initial)
  const [visibility, setVisibility] = useState(initialVisibility)
  const valid = noteTextSchema.safeParse(text).success

  // The guard asks between renders: it reads the latest values through a ref
  const latest = useRef({ text, visibility, valid, submit: async () => false })
  // "Saved" baseline: the text as saved, or '' for a new comment
  const savedText = useRef(initial)

  async function submit(event?: React.FormEvent) {
    event?.preventDefault()
    const current = latest.current
    if (!user || !current.valid) return false
    try {
      const done = await lock.run(async () => {
        await onSubmit(current.text, current.visibility, {
          email: normalizeEmail(user.email ?? ''),
          name: displayNameOf(user, profile.data),
        })
        return true
      })
      if (!done) return false
      savedText.current = current.text
      clearDraft(draftStorageKey)
      return true
    } catch {
      toast.error(t('errors.generic'))
      return false
    }
  }

  useLayoutEffect(() => {
    latest.current = { text, visibility, valid, submit }
  })

  useEffect(() => {
    writeDraft(draftStorageKey, text, savedText.current)
  }, [draftStorageKey, text])

  function changed() {
    const current = latest.current
    return (
      isDirty(current.text, savedText.current) ||
      (savedText.current !== '' && current.visibility !== initialVisibility)
    )
  }

  function discard() {
    clearDraft(draftStorageKey)
    savedText.current = latest.current.text
    onCancel()
  }

  useEffect(
    () =>
      guard.register(id, {
        dirty: changed,
        save: () => latest.current.submit(),
        discard,
        where: () => where ?? '',
      }),
    // `changed` / `discard` read refs; registering once per box is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guard, id, where],
  )

  function cancel() {
    // Esc / Cancelar with text: ask, like moving away
    if (!changed()) return discard()
    void guard.confirm().then((ok) => ok && discard())
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-2"
      data-testid="note-form"
    >
      {stored !== null && stored !== initial && (
        <p
          className="text-xs font-medium text-amber-800"
          data-testid="draft-recovered"
        >
          {t('unsaved.recovered')}
        </p>
      )}
      <Textarea
        value={text}
        rows={3}
        maxLength={MAX_NOTE_LENGTH}
        aria-label={t('notes.label')}
        placeholder={placeholder ?? t('notes.placeholder')}
        className="bg-white"
        readOnly={lock.saving}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (enterToSave && event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            // The lock ignores a held Enter while the first save runs
            if (!lock.isLocked()) void submit()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            cancel()
          }
        }}
        autoFocus
      />
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label={t('comments.visibility')}
      >
        {(['private', 'public'] as const).map((option) => (
          <Button
            key={option}
            type="button"
            size="xs"
            variant={visibility === option ? 'secondary' : 'ghost'}
            role="radio"
            aria-checked={visibility === option}
            disabled={lock.saving}
            className={cn(
              visibility === option &&
                option === 'public' &&
                'bg-sky-100 text-sky-900 hover:bg-sky-200',
            )}
            onClick={() => setVisibility(option)}
          >
            {option === 'public' ? <Users /> : <Lock />}
            {t(`comments.${option}`)}
          </Button>
        ))}
        <span className="truncate text-xs text-neutral-500">
          {visibility === 'public'
            ? t('comments.publicHint')
            : t('comments.privateHint')}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={lock.saving}
          onClick={cancel}
        >
          {t('common.cancel')}
        </Button>
        <SaveButton type="submit" size="sm" lock={lock} disabled={!valid}>
          {submitLabel}
        </SaveButton>
      </div>
    </form>
  )
}
