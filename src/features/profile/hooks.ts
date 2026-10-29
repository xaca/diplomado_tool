import { userRef } from '@/features/profile/api'
import { useLiveDoc } from '@/lib/firestore-hooks'
import type { UserDoc } from '@/model'
import { useAuth } from '@/providers/auth-context'

/** My users/{uid} document, live (the menu updates as soon as the profile is saved). */
export function useProfile() {
  const { user } = useAuth()
  return useLiveDoc<UserDoc>(user ? userRef(user.uid) : null, user?.uid ?? '')
}
