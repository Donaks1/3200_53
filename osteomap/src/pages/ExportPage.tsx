import { useEffect, useState } from 'react'
import { ArrowLeft, Database, Download, House, Info, Upload } from 'lucide-react'
import type { NavigateFn } from './types'
import { getCase } from '../db/caseOperation'
import { getContextById } from '../db/contextOperation'
import { getSiteById } from '../db/siteOperation'
import { applyImport, exportDatabaseCSV, exportSingleCaseCSV, findImportConflicts, parseImportCSV, type ConflictResolution, type ImportConflict, type ParsedImport} from '../db/exportImport'
import type { CaseRecord, ContextRecord, SiteRecord } from '../db/types'
import ImportConflictPopup from '../components/ImportConflictPopup'
import './ExportPage.css'

interface PendingImport {
  parsed: ParsedImport;
  conflicts: ImportConflict[];
  index: number;
  resolutions: Record<string, ConflictResolution>;
}

function ExportPage({ caseId, onNavigate }: { caseId?: string | null; onNavigate: NavigateFn }) {
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [contextData, setContextData] = useState<ContextRecord | null>(null);
  const [site, setSite] = useState<SiteRecord | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

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

  async function finishImport(parsed: ParsedImport, conflicts: ImportConflict[], resolutions: Record<string, ConflictResolution>) {
    setPendingImport(null);
    try {
      await applyImport(parsed, conflicts, resolutions);
      const skipped = conflicts.filter(c => resolutions[c.incoming.caseId] === 'skip').length;
      const imported = parsed.cases.length - skipped;
      setImportStatus(`Import successful! ${imported} specimen${imported === 1 ? '' : 's'} imported` +
        (skipped ? `, ${skipped} skipped.` : '.'));
    } catch {
      setImportStatus("Import failed. Please check the file and try again.");
    }
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportStatus("Importing...");
    try {
      const parsed = await parseImportCSV(file);
      const conflicts = await findImportConflicts(parsed);
      if (conflicts.length === 0) {
        await finishImport(parsed, conflicts, {});
        return;
      }
      setImportStatus("Waiting for you to resolve duplicate specimens...");
      setPendingImport({ parsed, conflicts, index: 0, resolutions: {} });
    } catch {
      setImportStatus("Import failed. Please check the file and try again.");
    }
  }

  function handleResolveConflict(resolution: ConflictResolution, applyToRemaining: boolean) {
    if (!pendingImport) return;
    const { parsed, conflicts, index } = pendingImport;
    const resolutions = { ...pendingImport.resolutions };
    const lastIndex = applyToRemaining ? conflicts.length - 1 : index;
    for (let i = index; i <= lastIndex; i++) {
      resolutions[conflicts[i].incoming.caseId] = resolution;
    }

    if (lastIndex + 1 >= conflicts.length) {
      void finishImport(parsed, conflicts, resolutions);
    } else {
      setPendingImport({ parsed, conflicts, index: lastIndex + 1, resolutions });
    }
  }

  function handleCancelImport() {
    setPendingImport(null);
    setImportStatus("Import cancelled. No changes were made.");
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

      {pendingImport && (
        <ImportConflictPopup
          key={pendingImport.index}
          conflict={pendingImport.conflicts[pendingImport.index]}
          position={pendingImport.index + 1}
          total={pendingImport.conflicts.length}
          onResolve={handleResolveConflict}
          onCancelImport={handleCancelImport}
        />
      )}
    </div>
  );
}

export default ExportPage;
