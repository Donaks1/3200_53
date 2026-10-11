import { useState } from 'react'
import HomePage from './pages/HomePage'
import SkeletonPage from './pages/SkeletonPage'
import ExportPage from './pages/ExportPage'
import MySkeletons from './pages/MySkeletons'
import type { Page } from './pages/types'

function App() {
  const [page, setPage] = useState<Page>('home')
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  // Where the export page was opened from, which is where its Back button goes.
  const [exportReturnPage, setExportReturnPage] = useState<Page>('home')

  // Every move names the specimen the next page is about, if any, so no page
  // ever picks up one left over from an earlier visit.
  function handleNavigate(nextPage: Page, caseId?: string) {
    if (nextPage === 'export' && page !== 'export') setExportReturnPage(page)
    setActiveCaseId(caseId ?? null)
    setPage(nextPage)
  }

  if (page === 'skeleton' && activeCaseId) return <SkeletonPage caseId={activeCaseId} onNavigate={handleNavigate} />
  if (page === 'export') return <ExportPage caseId={activeCaseId} returnTo={exportReturnPage} onNavigate={handleNavigate} />
  if (page === 'my-skeletons') return <MySkeletons onNavigate={handleNavigate} />
  return <HomePage onNavigate={handleNavigate} />
}

export default App
