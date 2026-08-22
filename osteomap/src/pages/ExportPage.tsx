import type { NavigateFn } from './types'
import './ExportPage.css' // Import the separate CSS file

function ExportPage({ onNavigate }: { onNavigate: NavigateFn }) {
  // Mock metadata representing active case details (added in this step)
  const activeCase = {
    siteCode: "UWA_2026",
    context: "Room_B_Spillway",
    skeletonId: "SK_053",
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
          <ul className="export-card-list">
            <li><strong>Site Code:</strong> {activeCase.siteCode}</li>
            <li><strong>Context:</strong> {activeCase.context}</li>
            <li><strong>Skeleton ID:</strong> {activeCase.skeletonId}</li>
            <li><strong>Bones Recorded:</strong> {activeCase.zonesRecorded}</li>
          </ul>
        </div>

        {/* Warning text placeholder */}
        <p className="export-reminder">
          * Reminder: Local storage data is temporary. Please back up your records.
        </p>

        {/* Basic Button (unpolished styling, ready for future responsive improvements) */}
        <div style={{ marginTop: '24px' }}>
          <button 
            type="button"
            className="export-button-basic"
          >
            Export as CSV (Placeholder Action)
          </button>
        </div>

      </main>
    </div>
  );
}

export default ExportPage;