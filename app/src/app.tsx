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
            background: '#0D1E36',
            border: '1px solid #1A3A5C',
            color: '#C8E8F8'
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
