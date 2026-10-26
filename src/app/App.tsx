import { RouterProvider } from 'react-router'
import { router } from '@/app/router'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/providers/AuthProvider'

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster richColors />
    </AuthProvider>
  )
}
