import { useEffect, useState } from 'react'
import { ArrowLeft, Database, Download, FileText, House, Info, Upload } from 'lucide-react'
import type { NavigateFn, Page } from './types'
import { getCase } from '../db/caseOperation'
import { getContextById } from '../db/contextOperation'
import { getSiteById } from '../db/siteOperation'
import { applyImport, exportDatabaseCSV, exportSingleCaseCSV, findImportConflicts, previewDatabaseCSV } from '../db/exportImport'
import type { ConflictResolution, ImportChoices, ImportConflict, ImportPreview } from '../db/exportImport'
import { exportCasePDF } from '../db/exportPdf'
import type { CaseRecord, ContextRecord, SiteRecord } from '../db/types'
import ImportConflictPopup from '../components/ImportConflictPopup'
import './ExportPage.css'

interface PendingImport {
  preview: ImportPreview;
  choices: ImportChoices;
  conflicts: ImportConflict[];
  index: number;
  resolutions: Record<string, ConflictResolution>;
}

// `returnTo` is the page this one was opened from, which Back goes back to.
function ExportPage({ caseId, returnTo, onNavigate }: { caseId?: string | null; returnTo?: Page; onNavigate: NavigateFn }) {
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [contextData, setContextData] = useState<ContextRecord | null>(null);
  const [site, setSite] = useState<SiteRecord | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importChoices, setImportChoices] = useState<ImportChoices>({ sites: {}, contexts: {} });
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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

  // An export that fails leaves the records as they were, but the person has
  // to know there is no backup file.
  async function runExport(exportFile: () => Promise<void>) {
    setExportError(null);
    try {
      await exportFile();
    } catch {
      setExportError("The export failed, so no file was saved. Your records haven't changed. Please try again.");
    }
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setPendingImport(null);
    setImportPreview(null);
    setImportChoices({ sites: {}, contexts: {} });
    setImportStatus('Checking file...');

    try {
      const preview = await previewDatabaseCSV(file);
      setImportPreview(preview);
      const unrecognised = preview.unrecognisedSegments;
      setImportStatus(
        `${preview.cases.length} specimen${preview.cases.length === 1 ? '' : 's'} ready for review.` +
        (unrecognised.length
          ? ` ${unrecognised.length} bone or zone ID${unrecognised.length === 1 ? '' : 's'} in the file ` +
            `${unrecognised.length === 1 ? "isn't" : "aren't"} in this version's drawings (${unrecognised.slice(0, 3).join(', ')}` +
            `${unrecognised.length > 3 ? ', …' : ''}); ${unrecognised.length === 1 ? 'it' : 'they'} will be kept as written.`
          : '')
      );
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'Import failed. Please check the file and try again.');
    }
  }

  const matchingName = (left: string, right: string) => left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();

  async function finishImport(
    preview: ImportPreview,
    choices: ImportChoices,
    resolutions: Record<string, ConflictResolution>
  ) {
    setIsApplyingImport(true);
    setImportStatus('Importing...');

    try {
      const result = await applyImport(preview, choices, resolutions);
      setPendingImport(null);
      setImportPreview(null);
      setImportChoices({ sites: {}, contexts: {} });
      setImportStatus(
        `Import successful. Imported ${result.casesImported} specimen${result.casesImported === 1 ? '' : 's'}, ` +
        `created ${result.sitesCreated} site${result.sitesCreated === 1 ? '' : 's'} and ` +
        `${result.contextsCreated} context${result.contextsCreated === 1 ? '' : 's'}, ` +
        `replaced ${result.casesReplaced} duplicate${result.casesReplaced === 1 ? '' : 's'}, ` +
        `skipped ${result.casesSkipped} specimen${result.casesSkipped === 1 ? '' : 's'}.`
      );
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'Import failed. Please try again.');
    } finally {
      setIsApplyingImport(false);
    }
  }

  async function handleStartImport() {
    if (!importPreview) return;

    setIsApplyingImport(true);
    setImportStatus('Checking for duplicates...');

    try {
      const conflicts = await findImportConflicts(importPreview, importChoices);
      if (!conflicts.length) {
        await finishImport(importPreview, importChoices, {});
        return;
      }

      setPendingImport({
        preview: importPreview,
        choices: importChoices,
        conflicts,
        index: 0,
        resolutions: {}
      });
      setImportStatus('Resolve duplicate specimens to continue.');
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'Import failed. Please try again.');
    } finally {
      setIsApplyingImport(false);
    }
  }

  function handleResolveConflict(resolution: ConflictResolution, applyToRemaining: boolean) {
    if (!pendingImport) return;

    const { conflicts, index } = pendingImport;
    const resolutions = { ...pendingImport.resolutions };
    const lastIndex = applyToRemaining ? conflicts.length - 1 : index;

    for (let i = index; i <= lastIndex; i++) {
      resolutions[conflicts[i].incoming.caseId] = resolution;
    }

    if (lastIndex + 1 >= conflicts.length) {
      void finishImport(pendingImport.preview, pendingImport.choices, resolutions);
      return;
    }

    setPendingImport({ ...pendingImport, index: lastIndex + 1, resolutions });
  }

  function handleCancelImport() {
    setPendingImport(null);
    setIsApplyingImport(false);
    setImportStatus('Import cancelled. No changes were made.');
  }

  return (
    <div className="export-page">
      {/* Header Navigation Bar */}
      <header className="export-header">
        <button
          type="button"
          onClick={() => onNavigate(returnTo ?? (caseId ? 'skeleton' : 'home'), caseId ?? undefined)}
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

        {/* Case Details Box: only when the page was opened for a specimen */}
        {caseId && (
          <div className="export-card">
            <h2 className="export-card-title">Active Case Data</h2>
            <ul className="export-card-list">
              <li><strong>Site Code:</strong> {site?.siteName || 'N/A'}</li>
              <li><strong>Context:</strong> {contextData?.contextName || 'N/A'}</li>
              <li><strong>Skeleton ID:</strong> {caseData?.caseName || 'N/A'}</li>
              <li><strong>Bones Recorded:</strong> {zonesRecorded}</li>
            </ul>
          </div>
        )}

        <div className="export-reminder">
          <Info aria-hidden="true" />
          <p>Keep a CSV backup of your records. Clearing your browser storage can delete data saved on this device.</p>
        </div>

        <section className="export-card export-actions" aria-labelledby="export-actions-title">
          <h2 id="export-actions-title" className="export-card-title">Export Records</h2>
          {caseId && (
            <button
              type="button"
              className="export-button-basic"
              disabled={!caseData}
              onClick={() => caseData && runExport(() => exportSingleCaseCSV(caseData.caseId))}
            >
              <Download aria-hidden="true" /> Export This Case (.csv)
            </button>
          )}

          {caseId && (
            <button
              type="button"
              className="export-button-basic"
              disabled={!caseData || isExportingPdf}
              onClick={async () => {
                if (!caseData) return;
                setIsExportingPdf(true);
                await runExport(() => exportCasePDF(caseData.caseId));
                setIsExportingPdf(false);
              }}
            >
              <FileText aria-hidden="true" /> {isExportingPdf ? 'Creating PDF...' : 'Export This Case (.pdf)'}
            </button>
          )}

          <button
            type="button"
            className="export-button-secondary"
            onClick={() => runExport(exportDatabaseCSV)}
          >
            <Database aria-hidden="true" /> Export Full Backup (.csv)
          </button>

          {exportError && <p className="export-import-status" role="alert">{exportError}</p>}
        </section>

        {/* Import Section */}
        <div className="export-card">
          <h2 className="export-card-title"><Upload aria-hidden="true" />Import Database</h2>
          <p id="export-import-description" className="export-card-description">
            Select a CSV file, review matching site/context names, then resolve any duplicate specimens.
          </p>
          <input
            type="file"
            className="export-file-input"
            aria-label="Choose a CSV backup to import"
            aria-describedby="export-import-description"
            accept="text/csv"
            onChange={handleImportFile}
            disabled={isApplyingImport}
          />

          {importPreview && !pendingImport && (
            <div className="export-import-review">
              <h3>Review site and context matches</h3>
              <p>
                Matching IDs automatically use existing records. If names match but IDs differ,
                choose an existing record or keep imported records separate.
              </p>

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
                      {matches.map((existing) => (
                        <option key={existing.siteId} value={existing.siteId}>
                          Use existing “{existing.siteName}” ({existing.siteId.slice(0, 8)})
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}

              {importPreview.contexts.map((importedContext) => {
                if (importPreview.existingContexts.some((existing) => existing.contextId === importedContext.contextId)) return null;

                const selectedSiteId = importChoices.sites[importedContext.siteId] || importedContext.siteId;
                const matches = importPreview.existingContexts.filter(
                  (existing) => existing.siteId === selectedSiteId && matchingName(existing.contextName, importedContext.contextName)
                );

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
                      {matches.map((existing) => (
                        <option key={existing.contextId} value={existing.contextId}>
                          Use existing “{existing.contextName}” ({existing.contextId.slice(0, 8)})
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}

              <button
                type="button"
                className="export-button-basic"
                disabled={isApplyingImport}
                onClick={handleStartImport}
              >
                <Upload aria-hidden="true" /> Review duplicates and import
              </button>
            </div>
          )}

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
