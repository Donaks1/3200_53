import { useEffect, useState } from 'react'
import type { NavigateFn } from './types'
import './ExportPage.css' // Import the separate CSS file
import { getCase } from '../db/caseOperation'
import { getContextById } from '../db/contextOperation'
import { getSiteById } from '../db/siteOperation'
import { exportDatabase, exportSingleCase } from '../db/exportImport'
import type { CaseRecord, ContextRecord, SiteRecord } from '../db/types'

function ExportPage({ caseId, onNavigate }: { caseId: string; onNavigate: NavigateFn }) {
  const [caseData, setCaseData] = useState<CaseRecord | null>(null)
  const [context, setContext] = useState<ContextRecord | null>(null)
  const [site, setSite] = useState<SiteRecord | null>(null)

  useEffect(() => {
    getCase(caseId).then(async (c) => {
      setCaseData(c ?? null)
      if (!c) return
      const ctx = await getContextById(c.contextId)
      setContext(ctx ?? null)
      if (ctx) setSite((await getSiteById(ctx.siteId)) ?? null)
    })
  }, [caseId])

  const zonesRecorded = caseData ? Object.keys(caseData.segmentStates).length : 0

  return (
    <div className="export-page">
      {/* Header Navigation Bar */}
      <header className="export-header">
        <button 
          type="button"
          onClick={() => onNavigate('skeleton', caseId)}
          className="export-header-back"
        >
          ← Back
        </button>
        <h1 className="export-header-title">Export Record (Active Case Setup)</h1>
        <button 
          type="button"
          onClick={() => onNavigate('home')}
          className="export-header-home"
        >
          Home
        </button>
      </header>

      {/* Main Container */}
      <main className="export-main">
        
        {/* Case Details Box */}
        <div className="export-card">
          <h2 className="export-card-title">Active Case Data</h2>
          {caseData ? (
            <ul className="export-card-list">
              <li><strong>Site Code:</strong> {site?.siteName}</li>
              <li><strong>Context:</strong> {context?.contextName}</li>
              <li><strong>Skeleton ID:</strong> {caseData.caseName}</li>
              <li><strong>Bones Recorded:</strong> {zonesRecorded}</li>
            </ul>
          ) : (
            <p>Loading case data...</p>
          )}
        </div>

        {/* Warning text placeholder */}
        <p className="export-reminder">
          * Reminder: Local storage data is temporary. Please back up your records.
        </p>

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
          <button type="button" className="export-button-basic" disabled={!caseData} onClick={() => caseData && exportSingleCase(caseData.caseId)}>
            Export This Case (JSON)
          </button>
          <button type="button" className="export-button-basic" onClick={() => exportDatabase()}>
            Export Full Backup (JSON)
          </button>
        </div>

      </main>
    </div>
  );
}

export default ExportPage;