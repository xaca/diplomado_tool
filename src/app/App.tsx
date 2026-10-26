import { RouterProvider } from 'react-router'
import { router } from '@/app/router'
import { AuthProvider } from '@/providers/AuthProvider'

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
