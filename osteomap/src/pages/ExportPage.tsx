import { useEffect, useState } from 'react'
import { ArrowLeft, Database, Download, House, Info, Upload } from 'lucide-react'
import type { NavigateFn } from './types'
import { getCase } from '../db/caseOperation'
import { getContextById } from '../db/contextOperation'
import { getSiteById } from '../db/siteOperation'
import { exportDatabaseCSV, exportSingleCaseCSV, importDatabaseCSV } from '../db/exportImport'
import type { CaseRecord, ContextRecord, SiteRecord } from '../db/types'
import './ExportPage.css'

function ExportPage({ caseId, onNavigate }: { caseId?: string | null; onNavigate: NavigateFn }) {
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [contextData, setContextData] = useState<ContextRecord | null>(null);
  const [site, setSite] = useState<SiteRecord | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;

    let active = true;

    getCase(caseId).then(async (c) => {
      if (!active) return;
      setCaseData(c ?? null);
      if (!c) return;

      const context = await getContextById(c.contextId);
      if (!active) return;
      setContextData(context ?? null);
      if (!context) return;

      const siteData = await getSiteById(context.siteId);
      if (!active) return;
      setSite(siteData ?? null);
    });

    return () => {
      active = false;
    };
  }, [caseId]);

  const zonesRecorded = Object.keys(caseData?.segmentStates ?? {}).length;

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus("Importing...");
    try {
      await importDatabaseCSV(file);
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
          <ArrowLeft aria-hidden="true" /> Back
        </button>
        <h1 className="export-header-title">Export Record</h1>
        <button 
          type="button"
          onClick={() => onNavigate('home')}
          className="export-header-home"
        >
          <House aria-hidden="true" /> Home
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

        <div className="export-reminder">
          <Info aria-hidden="true" />
          <p>Keep a CSV backup of your records. Clearing your browser storage can delete data saved on this device.</p>
        </div>

        <section className="export-card export-actions" aria-labelledby="export-actions-title">
          <h2 id="export-actions-title" className="export-card-title">Export Records</h2>
          <button 
            type="button"
            className="export-button-basic"
            disabled={!caseData}
            onClick={() => caseData && exportSingleCaseCSV(caseData.caseId)}
          >
            <Download aria-hidden="true" /> Export This Case (.csv)
          </button>
          
          <button 
            type="button"
            className="export-button-secondary"
            onClick={() => exportDatabaseCSV()}
          >
            <Database aria-hidden="true" /> Export Full Backup (.csv)
          </button>
        </section>

        {/* Import Section */}
        <div className="export-card">
          <h2 className="export-card-title"><Upload aria-hidden="true" />Import Database</h2>
          <p id="export-import-description" className="export-card-description">
            Select a CSV file to import into the application.
          </p>
          <input
            type="file"
            className="export-file-input"
            aria-label="Choose a CSV backup to import"
            aria-describedby="export-import-description"
            accept="text/csv"
            onChange={handleImportFile}
          />
          {importStatus && <p className="export-import-status" role="status">{importStatus}</p>}
        </div>
      </main>
    </div>
  );
}

export default ExportPage;
