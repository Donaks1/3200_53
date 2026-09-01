import { useEffect, useState } from 'react'
import type { NavigateFn } from './types'
import { getCase } from '../db/caseOperation'
import { getContextById } from '../db/contextOperation'
import { getSiteById } from '../db/siteOperation'
import { exportDatabase, exportSingleCase, importDatabase } from '../db/exportImport'
import type { CaseRecord, ContextRecord, SiteRecord } from '../db/types'
import './ExportPage.css' 

function ExportPage({ caseId, onNavigate }: { caseId: string | null; onNavigate: NavigateFn }) {
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [contextData, setContextData] = useState<ContextRecord | null>(null);
  const [site, setSite] = useState<SiteRecord | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    getCase(caseId).then(async (c) => {
      setCaseData(c ?? null);
      if (!c) return;
      const context = await getContextById(c.contextId);
      setContextData(context ?? null);
      if (context) {
        const siteData = await getSiteById(context.siteId);
        setSite(siteData ?? null);
      }
    });
  }, [caseId]);

  const zonesRecorded = caseData ? Object.keys(caseData.segmentStates).length : 0;

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus("Importing...");
    try {
      await importDatabase(file);
      setImportStatus("Import successful!");
    } catch {
      setImportStatus("Import failed. Please check the file and try again.");
    }
    event.target.value = '';
  }

  return (
    <div className="export-page">
      {/* Header Navigation Bar */}
      <header className="export-header">
        <button 
          type="button"
          onClick={() => onNavigate('skeleton', caseId || undefined)}
          className="export-header-back"
        >
          ← Back
        </button>
        <h1 className="export-header-title">Export Record</h1>
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
          <ul className="export-card-list">
            <li><strong>Site Code:</strong> {site?.siteName || 'N/A'}</li>
            <li><strong>Context:</strong> {contextData?.contextName || 'N/A'}</li>
            <li><strong>Skeleton ID:</strong> {caseData?.caseName || 'N/A'}</li>
            <li><strong>Bones Recorded:</strong> {zonesRecorded}</li>
          </ul>
        </div>

        {/* Added: Structural Warning Text (unpolished, standard alignment) */}
        <p className="export-reminder">
          <strong>Notice:</strong> This application operates offline-first. To prevent local browser storage clear-outs from deleting your data, export a backup as a CSV.
        </p>

        {/* Action Buttons (Added the second button structurally, but unstyled) */}
        <div style={{ marginTop: '24px' }}>
          <button 
            type="button"
            className="export-button-basic"
            disabled={!caseData}
            onClick={() => caseData && exportSingleCase(caseData.caseId)}
          >
            Export This Case (.json)
          </button>
          
          <button 
            type="button"
            style={{ 
              marginTop: '12px', 
              width: '100%', 
              padding: '10px 16px', 
              fontSize: '14px', 
              borderRadius: '8px',
              border: '1px dashed var(--border)',
              background: 'none',
              color: 'var(--text)',
              cursor: 'pointer'
            }}
            onClick={() => exportDatabase()}
          >
            Export Full Backup (.json)
          </button>
        </div>

        {/* Import Section */}
        <div className="export-card">
          <h2 className="export-card-title">Import Database</h2>
          <p className="export-card-description">
            Select a JSON file to import into the application.
          </p>
          <input
            type="file"
            accept="application/json"
            onChange={handleImportFile}
          />
          {importStatus && <p style={{ fontSize: '14px', color: 'var(--text)' }}>{importStatus}</p>}
        </div>
      </main>
    </div>
  );
}

export default ExportPage;