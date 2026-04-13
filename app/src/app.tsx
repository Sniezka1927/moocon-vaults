import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/app-layout'
import { GlobalLoader } from '@/components/global-loader'
import { AppProviders } from '@/lib/app-providers'
import { RouteObject, useRoutes } from 'react-router'
import { useIsFetching } from '@tanstack/react-query'
import { Toaster } from 'sonner'

import { HomePage } from '@/pages/home-page'
import { ProfilePage } from '@/pages/profile-page'
import { StatsPage } from '@/pages/stats-page'
import { RewardsPage } from '@/pages/rewards-page'

const routes: RouteObject[] = [
  { index: true, element: <HomePage /> },
  { path: 'profile', element: <ProfilePage /> },
  { path: 'account', element: <ProfilePage /> },
  { path: 'stats', element: <StatsPage /> },
  { path: 'rewards', element: <RewardsPage /> }
]

function AppContent() {
  const router = useRoutes(routes)
  const isFetching = useIsFetching()
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    if (!hasLoaded && isFetching === 0) {
      // Small delay so the loader doesn't flash away instantly
      const t = setTimeout(() => setHasLoaded(true), 200)
      return () => clearTimeout(t)
    }
  }, [isFetching, hasLoaded])

  return (
    <>
      {!hasLoaded && <GlobalLoader visible={!hasLoaded} />}
      <AppLayout>{router}</AppLayout>
    </>
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
