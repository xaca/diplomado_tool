import { createBrowserRouter } from 'react-router'
import { HomeRedirect, RequireAuth, RequireTeacher } from '@/app/guards'
import { AppShell } from '@/components/layout/AppShell'
import { BoardPage } from '@/pages/BoardPage'
import { JoinPage } from '@/pages/JoinPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { StudentHomePage } from '@/pages/StudentHomePage'
import { TeacherBoardPage } from '@/pages/TeacherBoardPage'
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
          { path: 'join/:code', element: <JoinPage /> },
          { path: 'b/:boardId', element: <BoardPage /> },
          {
            element: <RequireTeacher />,
            children: [
              { path: 'teacher', element: <TeacherHomePage /> },
              {
                path: 'teacher/boards/:boardId',
                element: <TeacherBoardPage />,
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
