import { useState } from 'react'
import HomePage from './pages/HomePage'
import SkeletonPage from './pages/SkeletonPage'
import ExportPage from './pages/ExportPage'
import type { Page } from './pages/types'

function App() {
  const [page, setPage] = useState<Page>('home')

  if (page === 'skeleton') return <SkeletonPage onNavigate={setPage} />
  if (page === 'export') return <ExportPage onNavigate={setPage} />
  return <HomePage onNavigate={setPage} />
}

export default App
