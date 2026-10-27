import { createBrowserRouter } from 'react-router'
import { HomeRedirect, RequireAuth, RequireTeacher } from '@/app/guards'
import { AppShell } from '@/components/layout/AppShell'
import { BoardPage } from '@/pages/BoardPage'
import { EditorRoute } from '@/pages/EditorRoute'
import { JoinPage } from '@/pages/JoinPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PresenterPage } from '@/pages/PresenterPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { SpacePage } from '@/pages/SpacePage'
import { StudentHomePage } from '@/pages/StudentHomePage'
import {
  StorageRoute,
  TeacherBoardRoute,
  TeacherHomeRoute,
} from '@/pages/TeacherRoutes'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Public: linked from the login page (Ley 1581 de 2012)
  { path: '/privacidad', element: <PrivacyPage /> },
  {
    element: <RequireAuth />,
    children: [
      // Full screen, without the app header
      { path: 'b/:boardId/present/:studentId?', element: <PresenterPage /> },
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <HomeRedirect studentHome={<StudentHomePage />} />,
          },
          { path: 'join/:code', element: <JoinPage /> },
          { path: 'b/:boardId', element: <BoardPage /> },
          { path: 'b/:boardId/s/:studentId', element: <SpacePage /> },
          {
            path: 'b/:boardId/s/:studentId/edit',
            element: <EditorRoute />,
          },
          {
            element: <RequireTeacher />,
            children: [
              { path: 'teacher', element: <TeacherHomeRoute /> },
              {
                path: 'teacher/boards/:boardId',
                element: <TeacherBoardRoute />,
              },
              {
                path: 'teacher/boards/:boardId/storage',
                element: <StorageRoute />,
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
