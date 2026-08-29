import type { NavigateFn } from './types'
import './ExportPage.css' 

function ExportPage({ onNavigate, caseId }: { onNavigate: NavigateFn; caseId?: string }) {
  const activeCase = {
    siteCode: "UWA_2026",
    context: "Room_B_Spillway",
    skeletonId: caseId ?? "SK_053",
    lastModified: "12 Aug 2026",
    zonesRecorded: 42
  };

  return (
    <div className="export-page">
      {/* Header Navigation Bar */}
      <header className="export-header">
        <button 
          type="button"
          onClick={() => onNavigate('skeleton')}
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
            <li><strong>Site Code:</strong> {activeCase.siteCode}</li>
            <li><strong>Context:</strong> {activeCase.context}</li>
            <li><strong>Skeleton ID:</strong> {activeCase.skeletonId}</li>
            <li><strong>Bones Recorded:</strong> {activeCase.zonesRecorded}</li>
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
            onClick={() => console.log('CSV Click')}
          >
            Export as CSV (.csv)
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
            onClick={() => console.log('PDF Click')}
          >
            Export as PDF (.pdf) [Draft]
          </button>
        </div>

      </main>
    </div>
  );
}

export default ExportPage;