import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Mail,
  Megaphone,
  Newspaper,
  Send,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AnnouncementsPanel } from '@/features/announcements/components/AnnouncementsPanel'
import {
  adminTabPath,
  isAdminTab,
  type AdminTab,
} from '@/features/boards/admin-tabs'
import { AdminTabs } from '@/features/boards/components/AdminTabs'
import { InvitePanel } from '@/features/boards/components/InvitePanel'
import { LifecyclePanel } from '@/features/boards/components/LifecyclePanel'
import { useBoard } from '@/features/boards/hooks'
import { useTeacherBoardSync } from '@/features/boards/sync'
import { ScheduleSummary } from '@/features/course/components/CourseCalendar'
import { CourseSetupForm } from '@/features/course/components/CourseSetupForm'
import {
  ClassCounter,
  NextClass,
} from '@/features/course/components/CourseStatus'
import { NewsPanel } from '@/features/course/components/NewsPanel'
import { formatDay } from '@/features/course/course'
import {
  useCourseState,
  useHeldDates,
  useNews,
  useNow,
} from '@/features/course/hooks'
import {
  EmailHistory,
  EmailSenderForm,
} from '@/features/mail/components/MailPanels'
import { weeklySummaryEmail } from '@/features/mail/summary'
import {
  SendEmailDialog,
  type EmailStart,
} from '@/features/mail/components/SendEmailDialog'
import { displayNameOf } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { EvaluationsPanel } from '@/features/evaluations/components/EvaluationsPanel'
import { PresentationsPanel } from '@/features/presentations/components/PresentationsPanel'
import { RecordingsPanel } from '@/features/recordings/components/RecordingsPanel'
import { useSpaces } from '@/features/spaces/hooks'
import { StagesPanel } from '@/features/stages/components/StagesPanel'
import { EmailsDialog } from '@/features/students/components/EmailsDialog'
import { ImportDialog } from '@/features/students/components/ImportDialog'
import { StudentFormDialog } from '@/features/students/components/StudentFormDialog'
import { StudentsTable } from '@/features/students/components/StudentsTable'
import { useStudents } from '@/features/students/hooks'
import { toStudentsFile } from '@/features/students/import'
import { downloadJson, slugify } from '@/lib/download'
import { useAuth } from '@/providers/auth-context'

function Panel({
  title,
  hint,
  action,
  children,
  testId,
}: {
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
  testId?: string
}) {
  return (
    <section
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * Administrar (M24, D108): one board, in tabs — Resumen, Estudiantes, Curso, Grabaciones,
 * Comunicación, Ajustes — each with its own link. Old `#recordings` links open Grabaciones.
 */
export function TeacherBoardPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const { boardId, tab: tabParam } = useParams()
  const { hash } = useLocation()
  const { user } = useAuth()
  const profile = useProfile()
  const board = useBoard(boardId)
  const students = useStudents(boardId)
  // Which students have a card: a joined student without one gets a "create card" button
  const spaces = useSpaces(boardId, null)
  const cardIds = useMemo(
    () =>
      spaces.loading ? null : new Set(spaces.data.map((space) => space.id)),
    [spaces.loading, spaces.data],
  )
  const [adding, setAdding] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [announcing, setAnnouncing] = useState(false)
  const [composing, setComposing] = useState<{
    start: EmailStart
    only?: string[]
  } | null>(null)
  const course = board.data?.course ?? null
  const held = useHeldDates(boardId, course, true)
  const state = useCourseState(course, held)
  const now = useNow()
  const news = useNews(boardId)
  // M12: my name / photo on the board header, and each card's group from the roster
  useTeacherBoardSync(
    board.data,
    spaces.loading ? null : spaces.data,
    students.loading ? null : students.data,
  )

  if (boardId && hash === '#recordings')
    return <Navigate to={adminTabPath(boardId, 'recordings')} replace />
  if (boardId && tabParam !== undefined && !isAdminTab(tabParam))
    return <Navigate to={adminTabPath(boardId)} replace />
  const tab: AdminTab = isAdminTab(tabParam) ? tabParam : 'overview'

  if (board.loading) {
    return (
      <section className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </section>
    )
  }

  if (!board.data || !boardId) {
    return (
      <section className="mx-auto max-w-5xl p-6">
        <p>{t('boards.notFound')}</p>
      </section>
    )
  }

  const data = board.data
  const joined = students.data.filter(
    (student) => student.status === 'joined',
  ).length
  const teacherName = user ? displayNameOf(user, profile.data) : ''
  const summary = () =>
    setComposing({
      start: weeklySummaryEmail(t, locale, boardId, data, news.data, now.date),
    })
  const message = () =>
    setComposing({ start: { kind: 'message', subject: '', body: '' } })

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-2">
        <Link
          to="/teacher"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t('teacher.title')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-semibold">
              {data.title}
            </h1>
            {data.description && (
              <p className="text-muted-foreground">{data.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAnnouncing(true)}>
              <Megaphone />
              {t('announcements.panel')}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to={`/teacher/boards/${boardId}/attendance`} />}
            >
              <ClipboardCheck />
              {t('attendance.button')}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to={`/b/${boardId}`} />}
            >
              <ExternalLink />
              {t('boards.open')}
            </Button>
          </div>
        </div>
      </div>

      <AdminTabs boardId={boardId} />

      {tab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2" data-testid="admin-overview">
          <Panel
            title={t('admin.courseCard')}
            testId="overview-course"
            action={
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link to={adminTabPath(boardId, 'course')} />}
              >
                <CalendarDays />
                {state.configured
                  ? t('admin.editCourse')
                  : t('admin.setUpCourse')}
              </Button>
            }
          >
            {state.configured ? (
              <div className="flex flex-col gap-3">
                <ClassCounter state={state} />
                {state.next && <NextClass next={state.next} today={now.date} />}
                {course && <ScheduleSummary course={course} />}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('admin.noCourse')}
              </p>
            )}
          </Panel>
          <Panel
            title={t('students.title')}
            testId="overview-students"
            action={
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link to={adminTabPath(boardId, 'students')} />}
              >
                <UserPlus />
                {t('admin.manageStudents')}
              </Button>
            }
          >
            <p className="text-sm">
              {t('students.counts', { total: students.data.length, joined })}
            </p>
          </Panel>
          <Panel
            title={t('admin.tabs.communication')}
            testId="overview-communication"
          >
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!students.data.length}
                onClick={message}
              >
                <Send />
                {t('mail.write')}
              </Button>
              <Button
                variant="outline"
                disabled={!students.data.length}
                onClick={summary}
              >
                <Newspaper />
                {t('mail.weeklySummary')}
              </Button>
            </div>
          </Panel>
          {news.data.some((item) => item.date >= now.date) && (
            <Panel title={t('admin.upcomingNews')} testId="overview-news">
              <ul className="flex flex-col gap-1 text-sm">
                {news.data
                  .filter((item) => item.date >= now.date)
                  .slice(0, 5)
                  .map((item) => (
                    <li key={item.id} className="flex gap-2">
                      <span className="w-24 shrink-0 text-muted-foreground">
                        {formatDay(item.date, locale, 'short')}
                      </span>
                      <span className="font-medium">
                        {t(`course.kinds.${item.kind}`)}
                      </span>
                      <span className="truncate">{item.title}</span>
                    </li>
                  ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      {tab === 'students' && (
        <>
          <InvitePanel board={data} />
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {t('students.title')}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  {t('students.counts', {
                    total: students.data.length,
                    joined,
                  })}
                </span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setAdding(true)}>
                  <UserPlus />
                  {t('students.add')}
                </Button>
                <ImportDialog boardId={boardId} roster={students.data} />
                <Button
                  variant="outline"
                  disabled={students.data.length === 0}
                  onClick={() => setEmailing(true)}
                >
                  <Mail />
                  {t('emails.button')}
                </Button>
                <Button
                  variant="outline"
                  disabled={students.data.length === 0}
                  onClick={() =>
                    downloadJson(
                      `estudiantes-${slugify(data.title)}.json`,
                      toStudentsFile(students.data),
                    )
                  }
                >
                  <Download />
                  {t('students.export')}
                </Button>
              </div>
            </div>

            {students.loading ? (
              <Skeleton className="h-40" />
            ) : (
              <StudentsTable
                boardId={boardId}
                students={students.data}
                cardIds={cardIds}
              />
            )}
          </div>
        </>
      )}

      {tab === 'course' && (
        <>
          <Panel
            title={t('course.setupTitle')}
            testId="course-panel"
            action={
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link to={`/b/${boardId}/calendario`} />}
              >
                <ExternalLink />
                {t('course.viewAsStudent')}
              </Button>
            }
          >
            <CourseSetupForm
              key={JSON.stringify(course)}
              boardId={boardId}
              board={{ ...data, id: boardId }}
              held={held}
            />
          </Panel>
          <Panel
            title={t('course.newsPanel')}
            hint={t('course.newsHint')}
            testId="news-section"
          >
            <NewsPanel
              boardId={boardId}
              today={now.date}
              onEmail={(item) =>
                setComposing({
                  start: {
                    kind: 'news',
                    subject: `${t(`course.kinds.${item.kind}`)}: ${item.title}`,
                    title: item.title,
                    body: [
                      item.wholeWeek
                        ? t('course.weekOf', {
                            date: formatDay(item.date, locale),
                          })
                        : formatDay(item.date, locale),
                      item.text,
                      item.link,
                    ]
                      .filter(Boolean)
                      .join('\n\n'),
                    link: `/b/${boardId}/calendario`,
                    linkLabel: t('mail.openCalendar'),
                  },
                })
              }
            />
          </Panel>
        </>
      )}

      {tab === 'recordings' && <RecordingsPanel boardId={boardId} />}

      {tab === 'presentations' && <PresentationsPanel boardId={boardId} />}

      {tab === 'evaluations' && <EvaluationsPanel boardId={boardId} />}

      {tab === 'communication' && (
        <>
          <Panel
            title={t('admin.tabs.communication')}
            hint={t('mail.panelHint')}
            testId="communication-actions"
          >
            <div className="flex flex-wrap gap-2">
              <Button disabled={!students.data.length} onClick={message}>
                <Send />
                {t('mail.write')}
              </Button>
              <Button
                variant="outline"
                disabled={!students.data.length}
                onClick={summary}
              >
                <Newspaper />
                {t('mail.weeklySummary')}
              </Button>
              <Button
                variant="outline"
                disabled={!students.data.length}
                onClick={() => setEmailing(true)}
              >
                <Copy />
                {t('emails.button')}
              </Button>
            </div>
          </Panel>
          <Panel
            title={t('mail.senderTitle')}
            hint={t('mail.senderPanelHint')}
            testId="sender-section"
          >
            <EmailSenderForm
              key={JSON.stringify(data.emailSender ?? null)}
              boardId={boardId}
              board={data}
              defaultName={
                teacherName ? `${data.title} – ${teacherName}` : data.title
              }
              gmail={user?.email ?? ''}
            />
          </Panel>
          <Panel title={t('mail.history')} testId="history-section">
            <EmailHistory boardId={boardId} />
          </Panel>
        </>
      )}

      {tab === 'settings' && (
        <>
          <StagesPanel key={JSON.stringify(data.stages ?? null)} board={data} />
          <LifecyclePanel board={data} />
        </>
      )}

      {announcing && (
        <AnnouncementsPanel
          boardId={boardId}
          members={joined}
          onClose={() => setAnnouncing(false)}
          onEmail={(announcement) => {
            setAnnouncing(false)
            setComposing({
              start: {
                kind: 'announcement',
                subject: announcement.title,
                title: announcement.title,
                body: announcement.body,
                link: announcement.link || undefined,
              },
            })
          }}
        />
      )}

      {emailing && (
        <EmailsDialog
          boardId={boardId}
          board={data}
          students={students.data}
          onClose={() => setEmailing(false)}
          onSend={(only) => {
            setEmailing(false)
            setComposing({
              start: { kind: 'message', subject: '', body: '' },
              only,
            })
          }}
        />
      )}

      {composing && (
        <SendEmailDialog
          boardId={boardId}
          board={{ ...data, id: boardId }}
          students={students.data}
          start={composing.start}
          only={composing.only}
          onClose={() => setComposing(null)}
        />
      )}

      {adding && (
        <StudentFormDialog
          boardId={boardId}
          roster={students.data}
          open
          onOpenChange={(open) => !open && setAdding(false)}
        />
      )}
    </section>
  )
}
