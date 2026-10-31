import { createBrowserRouter } from 'react-router'
import { HomeRedirect, RequireAuth, RequireTeacher } from '@/app/guards'
import { AppShell, type ShellHandle } from '@/components/layout/AppShell'
import { RouteError } from '@/components/layout/RouteError'
import { BoardPage } from '@/pages/BoardPage'
import { EditorRoute } from '@/pages/EditorRoute'
import { EmbedGuidePage } from '@/pages/EmbedGuidePage'
import { FocusPage } from '@/pages/FocusPage'
import { JoinPage } from '@/pages/JoinPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PresenterPage } from '@/pages/PresenterPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SpacePage } from '@/pages/SpacePage'
import { StudentHomePage } from '@/pages/StudentHomePage'
import {
  AttendanceRoute,
  StorageRoute,
  TeacherBoardRoute,
  TeacherHomeRoute,
} from '@/pages/TeacherRoutes'

// Friendly error page everywhere (and a reload onto the new version after a deploy)
const errorElement = <RouteError />

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement },
  // Public: linked from the login page (Ley 1581 de 2012)
  { path: '/privacidad', element: <PrivacyPage />, errorElement },
  // Public: "¿Cómo insertar…?" guide (M14), the teacher can share it with the class
  { path: '/ayuda/insertar', element: <EmbedGuidePage />, errorElement },
  {
    element: <RequireAuth />,
    errorElement,
    children: [
      // Full screen, without the app header
      { path: 'b/:boardId/present/:studentId?', element: <PresenterPage /> },
      // Class clock for the projector (M16)
      { path: 'b/:boardId/focus', element: <FocusPage /> },
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <HomeRedirect studentHome={<StudentHomePage />} />,
          },
          { path: 'join/:code', element: <JoinPage /> },
          { path: 'me', element: <ProfilePage /> },
          // One header: the board's own (app name and menu included)
          {
            path: 'b/:boardId',
            element: <BoardPage />,
            handle: { ownHeader: true } satisfies ShellHandle,
          },
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
              // M18: attendance by date
              {
                path: 'teacher/boards/:boardId/attendance',
                element: <AttendanceRoute />,
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage />, errorElement },
])
