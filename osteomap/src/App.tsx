import { useState } from 'react'
import HomePage from './pages/HomePage'
import SkeletonPage from './pages/SkeletonPage'
import ExportPage from './pages/ExportPage'
import MySkeletons from './pages/MySkeletons'
import type { Page } from './pages/types'

function App() {
  const [page, setPage] = useState<Page>('home')
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)

  function handleNavigate(nextPage: Page, caseId?: string) {
    if (caseId) setActiveCaseId(caseId)
    setPage(nextPage)
  }

  if (page === 'skeleton' && activeCaseId) return <SkeletonPage caseId={activeCaseId} onNavigate={handleNavigate} />
  if (page === 'export' && activeCaseId) return <ExportPage caseId={activeCaseId} onNavigate={handleNavigate} />
  if (page === 'my-skeletons') return <MySkeletons onNavigate={handleNavigate} />
  return <HomePage onNavigate={handleNavigate} />
}

export default App
