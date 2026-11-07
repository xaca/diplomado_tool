// Administrar in tabs (M24, F35, D108): each tab has its own link
export const ADMIN_TABS = [
  'overview',
  'students',
  'course',
  'recordings',
  'communication',
  'settings',
] as const
export type AdminTab = (typeof ADMIN_TABS)[number]

export const isAdminTab = (value: string | undefined): value is AdminTab =>
  ADMIN_TABS.includes(value as AdminTab)

export const adminTabPath = (boardId: string, tab: AdminTab = 'overview') =>
  tab === 'overview'
    ? `/teacher/boards/${boardId}`
    : `/teacher/boards/${boardId}/${tab}`
