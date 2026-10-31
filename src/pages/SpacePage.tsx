import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Pencil, PencilLine, Play, Presentation } from 'lucide-react'
import { toast } from 'sonner'
import { doc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBoard } from '@/features/boards/hooks'
import { SlideNotes } from '@/features/notes/components/SlideNotes'
import { useNotes } from '@/features/notes/hooks'
import { isWritable, lifecycleOf } from '@/features/boards/lifecycle'
import { markTeacherEditsSeen } from '@/features/slides/api'
import { SlidePreview } from '@/features/slides/components/SlidePreview'
import { TeacherEditBadge } from '@/features/slides/components/TeacherEditBadge'
import { useSlides } from '@/features/slides/hooks'
import { SpaceProfileDialog } from '@/features/spaces/components/SpaceProfileDialog'
import { useMyStudentId, useSpaces } from '@/features/spaces/hooks'
import { ReadyToggle } from '@/features/spaces/components/ReadyToggle'
import { ClockBanner } from '@/features/clock/components/ClockBanner'
import { PollsSection } from '@/features/polls/components/PollsSection'
import {
  DecorBanner,
  DecorSticker,
  StatusLine,
} from '@/features/profile/components/ProfileExtras'
import { MyAttendance } from '@/features/attendance/components/MyAttendance'
import { displayNameOf } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { clearCardStatus } from '@/features/spaces/api'
import { setSpaceStage } from '@/features/stages/api'
import { StageAvatar } from '@/features/stages/components/StageAvatar'
import { StagePicker } from '@/features/stages/components/StagePicker'
import { boardStages, findStage } from '@/features/stages/stages'
import { normalizeEmail } from '@/lib/collections'
import { db } from '@/lib/firebase'
import { useLiveDoc } from '@/lib/firestore-hooks'
import { IMAGE_SIZES, imageUrl } from '@/lib/cloudinary'
import { formatRelative, toDate } from '@/lib/time'
import { paths, type SpaceDoc } from '@/model'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

/** One student's space: the card and its slides (read-only for classmates and the teacher). */
export function SpacePage() {
  const { t, i18n } = useTranslation()
  const { boardId, studentId } = useParams()
  const { role, user } = useAuth()
  const board = useBoard(boardId)
  const me = useMyStudentId(boardId)
  const ref =
    boardId && studentId ? doc(db, paths.space(boardId, studentId)) : null
  const space = useLiveDoc<SpaceDoc>(ref, `space:${boardId}:${studentId}`)
  const slides = useSlides(boardId, studentId, space.data?.slideOrder)
  const [editing, setEditing] = useState(false)
  const isMine = !!me.studentId && me.studentId === studentId
  const teacher = isTeacherRole(role)
  // M15: the board's teacher may edit the student's slides
  const isBoardTeacher =
    teacher &&
    !!board.data?.teacherEmails.includes(normalizeEmail(user?.email ?? ''))
  // The student looked at their slides: the card's "✎ Docente" badge goes away
  const unseen = isMine && !!space.data?.teacherEditsUnseen
  useEffect(() => {
    if (unseen && boardId && studentId)
      void markTeacherEditsSeen(boardId, studentId).catch(() => undefined)
  }, [unseen, boardId, studentId])
  // The teacher's annotations: private to the teacher and the owner
  const notes = useNotes(boardId, studentId, teacher || isMine)
  // M16: polls need my name, and (teacher / author) classmates' names to show who voted
  const profile = useProfile()
  const classmates = useSpaces(
    isBoardTeacher || isMine ? boardId : undefined,
    null,
  )
  const names = useMemo(
    () => new Map(classmates.data.map((card) => [card.id, card.ownerName])),
    [classmates.data],
  )

  if (space.loading || board.loading) {
    return (
      <section className="mx-auto max-w-3xl p-6">
        <Skeleton className="h-64" />
      </section>
    )
  }

  if (!space.data || !boardId) {
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )
  }

  const spaceId = space.data.id
  const writable = !!board.data && isWritable(lifecycleOf(board.data))
  const canEdit = isMine && writable
  const stages = boardStages(board.data)
  const stage = findStage(stages, space.data.stage)
  const language = i18n.resolvedLanguage ?? 'es'

  async function changeStage(next: string | null) {
    if (!boardId) return
    try {
      await setSpaceStage(boardId, spaceId, next, 'teacher')
      toast.success(t('stages.saved'))
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  return (
    <>
      <ClockBanner
        boardId={boardId}
        clock={board.data?.clock}
        teacher={isBoardTeacher}
      />
      <section className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <Link
          to={`/b/${boardId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          {board.data?.title}
        </Link>

        <article
          className="rounded-2xl border border-black/5 p-6 shadow-sm"
          style={{ backgroundColor: space.data.color }}
          data-testid="space-detail"
        >
          <DecorBanner
            decor={space.data.ownerDecor}
            className="-mx-6 -mt-6 mb-4 h-4 rounded-t-2xl"
          />
          {space.data.cover && (
            <img
              src={imageUrl(space.data.cover, IMAGE_SIZES.slide)}
              alt=""
              className="mb-4 aspect-video w-full rounded-xl object-cover"
            />
          )}
          <header className="mb-4 flex items-center gap-3">
            <StageAvatar
              name={space.data.ownerName}
              photoURL={space.data.ownerPhotoURL}
              stage={stage}
              size={stage ? 88 : 48}
            />
            <div className="flex-1">
              <p className="font-semibold text-neutral-900">
                {space.data.ownerName}
                <DecorSticker decor={space.data.ownerDecor} />
              </p>
              {space.data.ownerStatus && (
                <div className="flex items-center gap-2">
                  <StatusLine
                    status={space.data.ownerStatus}
                    className="text-sm"
                  />
                  {isBoardTeacher && (
                    <Button
                      variant="ghost"
                      size="xs"
                      title={t('status.teacherClearHint')}
                      onClick={() =>
                        void clearCardStatus(boardId, spaceId).then(
                          () => toast.success(t('status.teacherCleared')),
                          () => toast.error(t('errors.generic')),
                        )
                      }
                    >
                      {t('status.teacherClear')}
                    </Button>
                  )}
                </div>
              )}
              <p className="text-xs text-neutral-500">
                {formatRelative(toDate(space.data.updatedAt), language)}
              </p>
              {stage && space.data.stageUpdatedAt != null && (
                <p
                  className="text-xs text-neutral-500"
                  data-testid="stage-since"
                >
                  {t('stages.since', {
                    when: formatRelative(
                      toDate(space.data.stageUpdatedAt),
                      language,
                    ),
                  })}
                  {space.data.stageSetBy === 'teacher' &&
                    ` · ${t('stages.setByTeacher')}`}
                </p>
              )}
            </div>
            {canEdit && (
              <ReadyToggle
                boardId={boardId}
                studentId={spaceId}
                ready={!!space.data.readyToPresent}
              />
            )}
            {canEdit && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                {t('space.edit')}
              </Button>
            )}
          </header>
          <h1 className="mb-2 text-2xl font-bold text-neutral-900">
            {space.data.title ||
              (isMine ? t('space.emptyMine') : t('space.empty'))}
          </h1>
          {space.data.summary && (
            <p className="whitespace-pre-line text-neutral-800">
              {space.data.summary}
            </p>
          )}
          {teacher && writable && (
            <div className="mt-4 rounded-xl bg-white/70 p-3">
              <StagePicker
                stages={stages}
                value={stage?.id ?? null}
                onChange={(next) => void changeStage(next)}
                legend={t('stages.teacherLegend')}
              />
            </div>
          )}
        </article>

        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">
            {t('space.slides', { count: space.data.slideCount })}
          </h2>
          <div className="flex gap-2">
            {(isMine || teacher) && space.data.slideCount > 0 && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to={`/b/${boardId}/present/${space.data.id}`} />}
              >
                <Play />
                {t('presenter.present')}
              </Button>
            )}
            {canEdit && (
              <Button
                nativeButton={false}
                render={<Link to={`/b/${boardId}/s/${space.data.id}/edit`} />}
              >
                <Presentation />
                {t('slides.edit')}
              </Button>
            )}
          </div>
        </div>

        {slides.data.length === 0 && !slides.loading ? (
          <p className="rounded-lg bg-muted p-4 text-sm">
            {canEdit ? t('slides.noneMine') : t('slides.none')}
          </p>
        ) : (
          <ol className="flex flex-col gap-4" data-testid="slides-viewer">
            {slides.data.map((slide, index) => (
              <li key={slide.id} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  {index + 1} / {slides.data.length}
                </span>
                <SlidePreview
                  slide={slide}
                  large
                  className="rounded-xl border shadow-sm"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <TeacherEditBadge
                    boardId={boardId}
                    studentId={spaceId}
                    slide={slide}
                    canRestore={isMine && writable}
                  />
                  {isBoardTeacher && writable && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      nativeButton={false}
                      render={
                        <Link
                          to={`/b/${boardId}/s/${spaceId}/edit?slide=${slide.id}`}
                        />
                      }
                    >
                      <PencilLine />
                      {t('teacherEdits.editSlide')}
                    </Button>
                  )}
                </div>
                {(teacher || isMine) && (
                  <SlideNotes
                    boardId={boardId}
                    studentId={spaceId}
                    slideId={slide.id}
                    notes={notes.bySlide.get(slide.id) ?? []}
                    canWrite={teacher}
                    teacherProfiles={board.data?.teacherProfiles}
                  />
                )}
              </li>
            ))}
          </ol>
        )}

        {(isMine || isBoardTeacher) && (
          <MyAttendance boardId={boardId} studentId={spaceId} mine={isMine} />
        )}

        {user && (
          <PollsSection
            boardId={boardId}
            studentId={spaceId}
            myStudentId={me.studentId}
            myUid={user.uid}
            myName={displayNameOf(user, profile.data)}
            teacher={isBoardTeacher}
            owner={isMine}
            writable={writable}
            names={names}
          />
        )}

        {editing && (
          <SpaceProfileDialog
            boardId={boardId}
            space={space.data}
            stages={stages}
            open
            onOpenChange={(open) => !open && setEditing(false)}
          />
        )}
      </section>
    </>
  )
}
