import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { joinWithCode, lookupJoinCode } from '@/features/membership/api'
import { useAuth } from '@/providers/auth-context'

type State =
  | { step: 'loading' }
  | { step: 'ready'; boardTitle: string }
  | { step: 'joining'; boardTitle: string }
  | { step: 'invalid' }
  | { step: 'rejected' }

export function JoinPage() {
  const { t } = useTranslation()
  const { code = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ step: 'loading' })

  useEffect(() => {
    let cancelled = false
    lookupJoinCode(code)
      .then((invite) => {
        if (!cancelled)
          setState(
            invite
              ? { step: 'ready', boardTitle: invite.boardTitle }
              : { step: 'invalid' },
          )
      })
      .catch(() => !cancelled && setState({ step: 'invalid' }))
    return () => {
      cancelled = true
    }
  }, [code])

  async function join(boardTitle: string) {
    if (!user) return
    setState({ step: 'joining', boardTitle })
    try {
      const boardId = await joinWithCode(user, code)
      navigate(`/b/${boardId}`, { replace: true })
    } catch {
      setState({ step: 'rejected' })
    }
  }

  return (
    <section className="flex justify-center p-6">
      <Card className="w-full max-w-md">
        {state.step === 'loading' && (
          <CardHeader>
            <CardDescription>{t('loading')}</CardDescription>
          </CardHeader>
        )}

        {(state.step === 'ready' || state.step === 'joining') && (
          <>
            <CardHeader>
              <CardDescription>{t('join.invitedTo')}</CardDescription>
              <CardTitle className="text-xl">{state.boardTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {t('join.as', { email: user?.email })}
              </p>
              <Button
                disabled={state.step === 'joining'}
                onClick={() => void join(state.boardTitle)}
              >
                {state.step === 'joining'
                  ? t('join.joining')
                  : t('join.button')}
              </Button>
            </CardContent>
          </>
        )}

        {(state.step === 'invalid' || state.step === 'rejected') && (
          <>
            <CardHeader>
              <CardTitle>{t('join.invalidTitle')}</CardTitle>
              <CardDescription>
                {t(state.step === 'invalid' ? 'join.invalid' : 'join.rejected')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to="/" />}
              >
                {t('notFound.back')}
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </section>
  )
}
