import { useState } from 'react'
import type { ConflictResolution, ImportConflict } from '../db/exportImport'
import type { CaseRecord } from '../db/types'

interface ImportConflictPopupProps {
  conflict: ImportConflict
  position: number
  total: number
  onResolve: (resolution: ConflictResolution, applyToRemaining: boolean) => void
  onCancelImport: () => void
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value || 'N/A' : date.toLocaleString()
}

function CaseSummary({ heading, record }: { heading: string; record: CaseRecord }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
      <p className="mb-1 font-semibold text-slate-800">{heading}</p>
      <p className="break-words"><strong>Name:</strong> {record.caseName}</p>
      <p><strong>Modified:</strong> {formatDate(record.dateModified)}</p>
      <p><strong>Bones recorded:</strong> {Object.keys(record.segmentStates ?? {}).length}</p>
    </div>
  )
}

function ImportConflictPopup({ conflict, position, total, onResolve, onCancelImport }: ImportConflictPopupProps) {
  const [applyToRemaining, setApplyToRemaining] = useState(false)
  const remaining = total - position

  const buttonClass = 'flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-xs transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-conflict-title"
        aria-describedby="import-conflict-description"
        className="w-full max-w-md rounded-2xl bg-white p-4 text-left shadow-lg"
      >
        <h2 id="import-conflict-title" className="mb-1 text-base font-bold text-slate-900">
          Duplicate specimen found
        </h2>
        <p id="import-conflict-description" className="mb-3 text-sm text-slate-600">
          {total > 1 && <span className="font-semibold">({position} of {total}) </span>}
          A specimen named <strong className="break-words">{conflict.incoming.caseName}</strong> already exists.
          Choose how to continue.
        </p>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <CaseSummary heading="Already saved" record={conflict.existing} />
          <CaseSummary heading="Being imported" record={conflict.incoming} />
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={`${buttonClass} border border-sky-600 bg-sky-600 text-white hover:bg-sky-700`}
            onClick={() => onResolve('rename', applyToRemaining)}
          >
            {applyToRemaining ? 'Keep both (rename imported copies)' : `Keep both as "${conflict.suggestedName}"`}
          </button>
          <button
            type="button"
            className={`${buttonClass} border border-red-600 bg-white text-red-700 hover:bg-red-50`}
            onClick={() => onResolve('replace', applyToRemaining)}
          >
            Replace existing with imported
          </button>
          <button
            type="button"
            className={`${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-100`}
            onClick={() => onResolve('skip', applyToRemaining)}
          >
            Skip this specimen
          </button>
        </div>

        {remaining > 0 && (
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={applyToRemaining}
              onChange={(event) => setApplyToRemaining(event.target.checked)}
            />
            Apply to the {remaining} remaining duplicate{remaining === 1 ? '' : 's'}
          </label>
        )}

        <button
          type="button"
          className="mt-3 w-full text-center text-xs font-semibold text-slate-500 underline hover:text-slate-700"
          onClick={onCancelImport}
        >
          Cancel entire import
        </button>
      </div>
    </div>
  )
}

export default ImportConflictPopup
