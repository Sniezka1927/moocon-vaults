import { AppLayout } from '@/components/app-layout'
import { AppProviders } from '@/lib/app-providers'
import { RouteObject, useRoutes } from 'react-router'
import { Toaster } from 'sonner'

import { HomePage } from '@/pages/home-page'

const routes: RouteObject[] = [{ index: true, element: <HomePage /> }]

function AppContent() {
  const router = useRoutes(routes)

  return (
    <AppLayout>{router}</AppLayout>
  )
}

export function App() {
  return (
    <AppProviders>
      <AppContent />
      <Toaster
        position="bottom-left"
        duration={5000}
        theme="dark"
        toastOptions={{
          style: {
            background: '#1E293B',
            border: '1px solid #2563EB40',
            color: '#E2E8F0'
          },
          classNames: {
            toast: 'toast-base',
            success: 'toast-success',
            error: 'toast-error'
          }
        }}
      />
    </AppProviders>
  )
}
