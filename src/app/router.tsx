import { createBrowserRouter } from 'react-router'
import { HomeRedirect, RequireAuth, RequireTeacher } from '@/app/guards'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { StudentHomePage } from '@/pages/StudentHomePage'
import { TeacherHomePage } from '@/pages/TeacherHomePage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <HomeRedirect studentHome={<StudentHomePage />} />,
          },
          {
            element: <RequireTeacher />,
            children: [{ path: 'teacher', element: <TeacherHomePage /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
