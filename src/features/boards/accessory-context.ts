import { createContext, useContext } from 'react'
import type { Accessory } from '@/features/boards/styles'

// Seasonal accessories on students' photos (M21, D73 / D75): the board page provides the active
// one (its style's, if the teacher has them on); StageAvatar draws it (components/Accessory.tsx).

export const AccessoryContext = createContext<Accessory | null>(null)

export function useAccessory() {
  return useContext(AccessoryContext)
}
