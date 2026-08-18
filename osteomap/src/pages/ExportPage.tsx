import type { NavigateFn } from './types'

function ExportPage({ onNavigate }: { onNavigate: NavigateFn }) {
  return (
    <div 
      className="min-h-screen flex flex-col p-4"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      {/* Header Navigation Bar */}
      <header className="flex items-center justify-between py-4 border-b mb-6" style={{ borderColor: 'var(--border)' }}>
        <button 
          type="button"
          onClick={() => onNavigate('skeleton')}
          className="font-medium cursor-pointer text-sm"
          style={{ color: 'var(--accent)' }}
        >
          ← Back
        </button>
        <h1 className="text-base font-bold" style={{ color: 'var(--text-h)' }}>
          Export Record (Draft)
        </h1>
        <button 
          type="button"
          onClick={() => onNavigate('home')}
          className="text-sm font-medium cursor-pointer"
        >
          Home
        </button>
      </header>

      {/* Main Container - Basic Placeholder Scaffolding */}
      <main className="flex-grow w-full max-w-md mx-auto flex flex-col justify-between gap-6">
        
        {/* Placeholder for case details */}
        <div 
          className="rounded-xl border p-5 text-left"
          style={{ borderColor: 'var(--border)', background: 'var(--social-bg)' }}
        >
          <h2 className="text-xs uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--accent)' }}>
            Case Details
          </h2>
          <p className="text-sm">Metadata and configuration options will go here.</p>
        </div>

        {/* Action Button Placeholders */}
        <div className="flex flex-col gap-3 mt-auto pt-6">
          <button 
            type="button"
            className="w-full font-bold py-3 px-4 rounded-xl text-center text-sm"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            CSV Export
          </button>
        </div>

      </main>
    </div>
  );
}

export default ExportPage;
