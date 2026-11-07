import { RouterProvider } from 'react-router'
import { router } from '@/app/router'
import { Toaster } from '@/components/ui/sonner'
import { UnsavedGuardProvider } from '@/features/notes/unsaved-guard'
import { AuthProvider } from '@/providers/AuthProvider'

export function App() {
  return (
    <AuthProvider>
      {/* M27: "Tienes un comentario sin guardar" before moving on */}
      <UnsavedGuardProvider>
        <RouterProvider router={router} />
      </UnsavedGuardProvider>
      <Toaster richColors />
    </AuthProvider>
  )
}
