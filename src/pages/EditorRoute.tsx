import { lazy, Suspense } from 'react'

// The editor page is its own chunk (Excalidraw is yet another lazy chunk inside it)
const EditorPage = lazy(() =>
  import('@/pages/EditorPage').then((m) => ({ default: m.EditorPage })),
)

export function EditorRoute() {
  return (
    <Suspense>
      <EditorPage />
    </Suspense>
  )
}
