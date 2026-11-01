import { createBrowserRouter } from 'react-router'
import { HomeRedirect, RequireAuth, RequireTeacher } from '@/app/guards'
import { AppShell, type ShellHandle } from '@/components/layout/AppShell'
import { RouteError } from '@/components/layout/RouteError'
import { AchievementsPage } from '@/pages/AchievementsPage'
import { BoardPage } from '@/pages/BoardPage'
import { ClassDesignPage } from '@/pages/ClassDesignPage'
import { ClassesPage } from '@/pages/ClassesPage'
import { ClassPage } from '@/pages/ClassPage'
import { ClassPresentPage } from '@/pages/ClassPresentPage'
import { EditorRoute } from '@/pages/EditorRoute'
import { EmbedGuidePage } from '@/pages/EmbedGuidePage'
import { FocusPage } from '@/pages/FocusPage'
import { JoinPage } from '@/pages/JoinPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PresenterPage } from '@/pages/PresenterPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { RecordingPlayerPage } from '@/pages/RecordingPlayerPage'
import { RecordingsPage } from '@/pages/RecordingsPage'
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
      // M10: a class's sticky-note wall on the projector
      {
        path: 'b/:boardId/class/:classId/present',
        element: <ClassPresentPage />,
      },
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
          // M22: achievements
          { path: 'b/:boardId/logros', element: <AchievementsPage /> },
          // M23: recorded classes (YouTube playlists) and the study player
          { path: 'b/:boardId/videos', element: <RecordingsPage /> },
          {
            path: 'b/:boardId/videos/:recordingId',
            element: <RecordingPlayerPage />,
          },
          // M10: class participation (sticky-note walls)
          { path: 'b/:boardId/class', element: <ClassesPage /> },
          { path: 'b/:boardId/class/:classId', element: <ClassPage /> },
          // M10b: the teacher designs a class slide with Excalidraw
          {
            path: 'b/:boardId/class/:classId/s/:slideId/design',
            element: <ClassDesignPage />,
          },
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
