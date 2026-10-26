import { useEffect, useState } from 'react'
import {
  onSnapshot,
  type DocumentReference,
  type Query,
} from 'firebase/firestore'

// Live Firestore subscriptions for feature hooks. Pass null to skip (e.g. while ids are unknown).

export type WithId<T> = T & { id: string }

type LiveState<T> = { data: T; loading: boolean; error: Error | null }

export function useLiveQuery<T>(
  query: Query | null,
  key: string,
): LiveState<WithId<T>[]> {
  const [state, setState] = useState<LiveState<WithId<T>[]> & { key: string }>({
    data: [],
    loading: true,
    error: null,
    key,
  })

  useEffect(() => {
    if (!query) return
    return onSnapshot(
      query,
      (snapshot) =>
        setState({
          data: snapshot.docs.map((doc) => ({
            ...(doc.data() as T),
            id: doc.id,
          })),
          loading: false,
          error: null,
          key,
        }),
      (error) => setState({ data: [], loading: false, error, key }),
    )
    // `key` identifies the query; Query objects are recreated on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!query) return { data: [], loading: false, error: null }
  // A new key means a new query: report loading until its first snapshot
  if (state.key !== key) return { data: [], loading: true, error: null }
  return state
}

export function useLiveDoc<T>(
  ref: DocumentReference | null,
  key: string,
): LiveState<WithId<T> | null> {
  const [state, setState] = useState<
    LiveState<WithId<T> | null> & { key: string }
  >({
    data: null,
    loading: true,
    error: null,
    key,
  })

  useEffect(() => {
    if (!ref) return
    return onSnapshot(
      ref,
      (snapshot) =>
        setState({
          data: snapshot.exists()
            ? { ...(snapshot.data() as T), id: snapshot.id }
            : null,
          loading: false,
          error: null,
          key,
        }),
      (error) => setState({ data: null, loading: false, error, key }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!ref) return { data: null, loading: false, error: null }
  if (state.key !== key) return { data: null, loading: true, error: null }
  return state
}
