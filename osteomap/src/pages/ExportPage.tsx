import { useEffect, useState } from 'react'
import { ArrowLeft, Database, Download, House, Info, Upload } from 'lucide-react'
import type { NavigateFn } from './types'
import { getCase } from '../db/caseOperation'
import { getContextById } from '../db/contextOperation'
import { getSiteById } from '../db/siteOperation'
import { exportDatabaseCSV, exportSingleCaseCSV, importDatabaseCSV, previewDatabaseCSV } from '../db/exportImport'
import type { ImportChoices, ImportPreview } from '../db/exportImport'
import type { CaseRecord, ContextRecord, SiteRecord } from '../db/types'
import './ExportPage.css'

function ExportPage({ caseId, onNavigate }: { caseId?: string | null; onNavigate: NavigateFn }) {
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [contextData, setContextData] = useState<ContextRecord | null>(null);
  const [site, setSite] = useState<SiteRecord | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importChoices, setImportChoices] = useState<ImportChoices>({ sites: {}, contexts: {} });
  const [importing, setImporting] = useState(false);

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

    setImportPreview(null);
    setImportChoices({ sites: {}, contexts: {} });
    setImportStatus("Checking file...");
    try {
      const preview = await previewDatabaseCSV(file);
      setImportPreview(preview);
      setImportStatus(`${preview.cases.length} case${preview.cases.length === 1 ? '' : 's'} ready to review.`);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Could not read this CSV file.");
    }
    event.target.value = '';
  }

  async function confirmImport() {
    if (!importPreview) return;
    setImporting(true);
    setImportStatus('Importing...');
    try {
      const result = await importDatabaseCSV(importPreview, importChoices);
      setImportStatus(`Imported ${result.casesImported} case${result.casesImported === 1 ? '' : 's'}; created ${result.sitesCreated} site${result.sitesCreated === 1 ? '' : 's'} and ${result.contextsCreated} context${result.contextsCreated === 1 ? '' : 's'}.${result.casesSkipped ? ` Skipped ${result.casesSkipped} case${result.casesSkipped === 1 ? '' : 's'} with existing IDs.` : ''}`);
      setImportPreview(null);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  const matchingName = (left: string, right: string) => left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();

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
            Select a CSV file, review any matching names, then import.
          </p>
          <input
            type="file"
            className="export-file-input"
            aria-label="Choose a CSV backup to import"
            aria-describedby="export-import-description"
            accept="text/csv"
            onChange={handleImportFile}
          />
          {importPreview && (
            <div className="export-import-review">
              <h3>Review import</h3>
              <p>Matching IDs use existing records. For matching names with different IDs, choose whether to use an existing record or keep the imported one separate.</p>
              {importPreview.sites.map((importedSite) => {
                if (importPreview.existingSites.some((existing) => existing.siteId === importedSite.siteId)) return null;
                const matches = importPreview.existingSites.filter((existing) => matchingName(existing.siteName, importedSite.siteName));
                if (!matches.length) return null;
                return (
                  <label className="export-import-choice" key={importedSite.siteId}>
                    <span>Site “{importedSite.siteName}”</span>
                    <select
                      value={importChoices.sites[importedSite.siteId] || ''}
                      onChange={(event) => setImportChoices((current) => ({
                        sites: { ...current.sites, [importedSite.siteId]: event.target.value },
                        contexts: {}
                      }))}
                    >
                      <option value="">Keep as a separate site</option>
                      {matches.map((existing) => <option key={existing.siteId} value={existing.siteId}>Use existing “{existing.siteName}” ({existing.siteId.slice(0, 8)})</option>)}
                    </select>
                  </label>
                );
              })}
              {importPreview.contexts.map((importedContext) => {
                if (importPreview.existingContexts.some((existing) => existing.contextId === importedContext.contextId)) return null;
                const siteId = importChoices.sites[importedContext.siteId] || importedContext.siteId;
                const matches = importPreview.existingContexts.filter((existing) => existing.siteId === siteId && matchingName(existing.contextName, importedContext.contextName));
                if (!matches.length) return null;
                return (
                  <label className="export-import-choice" key={importedContext.contextId}>
                    <span>Context “{importedContext.contextName}”</span>
                    <select
                      value={importChoices.contexts[importedContext.contextId] || ''}
                      onChange={(event) => setImportChoices((current) => ({
                        ...current,
                        contexts: { ...current.contexts, [importedContext.contextId]: event.target.value }
                      }))}
                    >
                      <option value="">Keep as a separate context</option>
                      {matches.map((existing) => <option key={existing.contextId} value={existing.contextId}>Use existing “{existing.contextName}” ({existing.contextId.slice(0, 8)})</option>)}
                    </select>
                  </label>
                );
              })}
              <button type="button" className="export-button-basic" disabled={importing} onClick={confirmImport}>
                <Upload aria-hidden="true" /> Import {importPreview.cases.length} case{importPreview.cases.length === 1 ? '' : 's'}
              </button>
            </div>
          )}
          {importStatus && <p className="export-import-status" role="status">{importStatus}</p>}
        </div>
      </main>
    </div>
  );
}

export default ExportPage;
