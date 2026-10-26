import { useEffect, useState } from 'react'
import type { WithId } from '@/lib/firestore-hooks'
import { autoJoinFromEmail, fetchMyBoards } from '@/features/membership/api'
import type { BoardDoc } from '@/model'
import { useAuth } from '@/providers/auth-context'

type State = {
  boards: WithId<BoardDoc>[]
  loading: boolean
  error: Error | null
  uid: string | null
}

/** Student home: joins any board that lists my email, then loads my boards. */
export function useMyBoards() {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const [state, setState] = useState<State>({
    boards: [],
    loading: true,
    error: null,
    uid,
  })

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        await autoJoinFromEmail(user)
        const boards = await fetchMyBoards(user)
        if (!cancelled)
          setState({ boards, loading: false, error: null, uid: user.uid })
      } catch (error) {
        console.error('[membership] auto-join / my boards failed', error)
        if (!cancelled)
          setState({
            boards: [],
            loading: false,
            error: error as Error,
            uid: user.uid,
          })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  if (state.uid !== uid) return { boards: [], loading: true, error: null }
  return state
}
