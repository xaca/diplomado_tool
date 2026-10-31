import { useMemo } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ACHIEVEMENT_INFO,
  byGroup,
  GROUPS,
  share,
  unlockedCount,
} from '@/features/achievements/achievements'
import {
  useAchievementCounts,
  useAllAchievements,
  useMyAchievements,
} from '@/features/achievements/hooks'
import { BoardSections } from '@/features/classes/components/BoardSections'
import { useClassAccess } from '@/features/classes/use-class-access'
import { useSpaces } from '@/features/spaces/hooks'
import { toDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import { ACHIEVEMENTS, type AchievementKey } from '@/model'

/** A round badge: colored when unlocked, grey with a lock otherwise */
function Badge({
  achievement,
  unlocked,
}: {
  achievement: AchievementKey
  unlocked: boolean
}) {
  const info = ACHIEVEMENT_INFO[achievement]
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex size-12 shrink-0 items-center justify-center rounded-full text-2xl shadow-sm',
        !unlocked && 'grayscale',
      )}
      style={{
        background: unlocked
          ? `radial-gradient(circle at 30% 30%, #fff8, transparent 60%), ${info.color}`
          : '#e5e7eb',
        opacity: unlocked ? 1 : 0.7,
      }}
    >
      {info.emoji}
      {!unlocked && (
        <Lock className="absolute -right-0.5 -bottom-0.5 size-4 rounded-full bg-white p-0.5 text-neutral-500" />
      )}
    </span>
  )
}

function Counter({ count, total }: { count?: number; total: number }) {
  const { t } = useTranslation()
  const value = share(count, total)
  return (
    <div className="flex w-36 shrink-0 flex-col gap-1 text-right">
      <span className="text-xs text-muted-foreground" data-testid="counter">
        {t('achievements.progress', { count: value.count, total })}
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          className="bar-grow block h-full rounded-full bg-primary/70"
          style={{ width: `${value.percent}%` }}
        />
      </span>
    </div>
  )
}

/**
 * "Logros" (M22): every achievement of the board with how many students unlocked it. Students
 * see their own (unlocked with the date, locked with how to get it); the teacher can open each
 * one to see who has it and who doesn't yet. Never a ranking (D56, D85).
 */
export function AchievementsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const { boardId = '' } = useParams()
  const access = useClassAccess(boardId)
  const counts = useAchievementCounts(access.allowed ? boardId : undefined)
  const mine = useMyAchievements(
    access.member ? boardId : undefined,
    access.uid,
  )
  const all = useAllAchievements(boardId, access.teacher)
  const spaces = useSpaces(access.allowed ? boardId : undefined, null)
  const total = spaces.data.length
  const names = useMemo(
    () => new Map(spaces.data.map((space) => [space.id, space.ownerName])),
    [spaces.data],
  )

  if (!access.loading && !access.allowed)
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )

  const unlocked = mine.data?.unlocked
  const loading =
    access.loading ||
    counts.loading ||
    spaces.loading ||
    (access.member && mine.loading)

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 sm:p-6">
      <BoardSections boardId={boardId} />
      <div>
        <p className="text-sm text-muted-foreground">
          {access.board.data?.title}
        </p>
        <h1 className="font-heading text-2xl font-semibold">
          🏆 {t('achievements.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {access.teacher
            ? t('achievements.teacherHint')
            : t('achievements.hint')}
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          {access.member && (
            <p
              className="rounded-xl bg-amber-50 px-4 py-3 font-medium text-amber-900"
              data-testid="my-summary"
            >
              {t('achievements.summary', {
                count: unlockedCount(unlocked),
                total: ACHIEVEMENTS.length,
              })}
            </p>
          )}
          {GROUPS.map((group) => (
            <div key={group} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t(`achievements.groups.${group}`)}
              </h2>
              <ul className="flex flex-col gap-2">
                {byGroup(group).map((key) => {
                  const at = unlocked?.[key]
                  const row = (
                    <div className="flex items-center gap-3">
                      <Badge
                        achievement={key}
                        unlocked={access.teacher || !!at}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {t(`achievements.items.${key}.name`)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {access.member && at
                            ? t('achievements.unlockedOn', {
                                date: toDate(at).toLocaleDateString(locale, {
                                  day: 'numeric',
                                  month: 'short',
                                }),
                              })
                            : t(`achievements.items.${key}.how`)}
                        </p>
                      </div>
                      <Counter count={counts.data?.[key]} total={total} />
                    </div>
                  )
                  if (!access.teacher)
                    return (
                      <li
                        key={key}
                        className={cn(
                          'rounded-xl border p-3',
                          at ? 'bg-card' : 'bg-muted/30',
                        )}
                        data-testid="achievement"
                        data-key={key}
                        data-unlocked={!!at}
                      >
                        {row}
                      </li>
                    )
                  // Teacher: who has it and who doesn't yet
                  const who = new Set(
                    all.data
                      .filter((item) => item.unlocked?.[key])
                      .map((item) => item.studentId),
                  )
                  const have = spaces.data.filter((space) => who.has(space.id))
                  const notYet = spaces.data.filter(
                    (space) => !who.has(space.id),
                  )
                  return (
                    <li
                      key={key}
                      className="rounded-xl border bg-card"
                      data-testid="achievement"
                      data-key={key}
                    >
                      <details>
                        <summary className="cursor-pointer list-none p-3">
                          {row}
                        </summary>
                        <div className="grid gap-3 border-t p-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="mb-1 font-medium">
                              {t('achievements.who', { count: have.length })}
                            </p>
                            <p
                              className="text-muted-foreground"
                              data-testid="who"
                            >
                              {have.length
                                ? have
                                    .map((space) => names.get(space.id))
                                    .join(', ')
                                : t('achievements.nobody')}
                            </p>
                          </div>
                          <div>
                            <p className="mb-1 font-medium">
                              {t('achievements.notYet', {
                                count: notYet.length,
                              })}
                            </p>
                            <p className="text-muted-foreground">
                              {notYet
                                .map((space) => names.get(space.id))
                                .join(', ')}
                            </p>
                          </div>
                        </div>
                      </details>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  )
}
