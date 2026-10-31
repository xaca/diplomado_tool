import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquareText, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { displayNameOf } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import {
  addNote,
  deleteNote,
  updateNote,
  type Note,
} from '@/features/notes/api'
import { StageAvatar } from '@/features/stages/components/StageAvatar'
import { normalizeEmail } from '@/lib/collections'
import { formatRelative, toDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import { MAX_NOTE_LENGTH, noteTextSchema, type TeacherProfile } from '@/model'
import { useAuth } from '@/providers/auth-context'

type Props = {
  boardId: string
  studentId: string
  slideId: string
  notes: Note[]
  /** The board's teacher writes; the student only reads */
  canWrite: boolean
  /** Teachers' names and photos (board.teacherProfiles, M12) for the #DOCENTE avatar */
  teacherProfiles?: Record<string, TeacherProfile>
  className?: string
  /** Presenter (M13): Enter saves, Shift+Enter new line */
  enterToSave?: boolean
}

/** The teacher's annotations on one slide. Renders nothing for the student when there are none. */
export function SlideNotes({
  boardId,
  studentId,
  slideId,
  notes,
  canWrite,
  teacherProfiles,
  className,
  enterToSave = false,
}: Props) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)

  if (!canWrite && notes.length === 0) return null

  return (
    <section
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-neutral-900',
        className,
      )}
      aria-label={t('notes.title')}
      data-testid="slide-notes"
    >
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <MessageSquareText className="size-4" />
        {t('notes.title')}
        {notes.length > 0 && (
          <span className="font-normal text-neutral-500">· {notes.length}</span>
        )}
      </h3>

      {notes.map((note) => (
        <NoteItem
          key={note.id}
          boardId={boardId}
          studentId={studentId}
          note={note}
          canWrite={canWrite}
          photoURL={teacherProfiles?.[note.authorEmail]?.photoURL ?? null}
          enterToSave={enterToSave}
        />
      ))}

      {canWrite &&
        (adding ? (
          <NoteForm
            submitLabel={t('notes.add')}
            enterToSave={enterToSave}
            onCancel={() => setAdding(false)}
            onSubmit={async (text, author) => {
              await addNote(boardId, studentId, slideId, author, text)
              setAdding(false)
            }}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setAdding(true)}
          >
            {t('notes.new')}
          </Button>
        ))}
    </section>
  )
}

function NoteItem({
  boardId,
  studentId,
  note,
  canWrite,
  photoURL,
  enterToSave,
}: {
  boardId: string
  studentId: string
  note: Note
  canWrite: boolean
  photoURL: string | null
  enterToSave: boolean
}) {
  const { t, i18n } = useTranslation()
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <NoteForm
        initial={note.text}
        submitLabel={t('common.save')}
        enterToSave={enterToSave}
        onCancel={() => setEditing(false)}
        onSubmit={async (text) => {
          await updateNote(boardId, studentId, note.id, text)
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
    >
      <header className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
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
              onClick={() =>
                void deleteNote(boardId, studentId, note.id).catch(() =>
                  toast.error(t('errors.generic')),
                )
              }
            >
              <Trash2 />
            </Button>
          </span>
        )}
      </header>
      <p className="whitespace-pre-line">{note.text}</p>
    </article>
  )
}

function NoteForm({
  initial = '',
  submitLabel,
  onSubmit,
  onCancel,
  enterToSave = false,
}: {
  initial?: string
  submitLabel: string
  enterToSave?: boolean
  onSubmit: (
    text: string,
    author: { email: string; name: string },
  ) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const profile = useProfile()
  const [text, setText] = useState(initial)
  const [saving, setSaving] = useState(false)
  const valid = noteTextSchema.safeParse(text).success

  async function submit(event?: React.FormEvent) {
    event?.preventDefault()
    if (!user || !valid || saving) return
    setSaving(true)
    try {
      await onSubmit(text, {
        email: normalizeEmail(user.email ?? ''),
        name: displayNameOf(user, profile.data),
      })
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Textarea
        value={text}
        rows={3}
        maxLength={MAX_NOTE_LENGTH}
        aria-label={t('notes.label')}
        placeholder={t('notes.placeholder')}
        className="bg-white"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (enterToSave && event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void submit()
          }
          if (event.key === 'Escape') onCancel()
        }}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={!valid || saving}>
          {saving ? t('common.saving') : submitLabel}
        </Button>
      </div>
    </form>
  )
}
