import { lazy, Suspense } from 'react'

// Teacher area: its own chunk (students never download it)
const TeacherHomePage = lazy(() =>
  import('@/pages/TeacherHomePage').then((m) => ({
    default: m.TeacherHomePage,
  })),
)
const TeacherBoardPage = lazy(() =>
  import('@/pages/TeacherBoardPage').then((m) => ({
    default: m.TeacherBoardPage,
  })),
)
const StoragePage = lazy(() =>
  import('@/pages/StoragePage').then((m) => ({ default: m.StoragePage })),
)

export function TeacherHomeRoute() {
  return (
    <Suspense>
      <TeacherHomePage />
    </Suspense>
  )
}

export function TeacherBoardRoute() {
  return (
    <Suspense>
      <TeacherBoardPage />
    </Suspense>
  )
}

export function StorageRoute() {
  return (
    <Suspense>
      <StoragePage />
    </Suspense>
  )
}
