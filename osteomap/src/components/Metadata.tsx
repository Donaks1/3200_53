import { useEffect, useState } from 'react'
import type { AgeGroup } from '../db/types'
import { Bone, Check, X } from 'lucide-react'

export interface SpecimenMetadata {
  sex: string
  ageGroup: AgeGroup
  fieldNotes: string
}

interface MetadataProps {
  isOpen: boolean
  caseName?: string
  initialMetadata?: Partial<SpecimenMetadata>
  onSave: (metadata: SpecimenMetadata) => void
  onCancel: () => void
}

const DEFAULT_METADATA: SpecimenMetadata = {
  sex: 'unknown',
  ageGroup: 'adult',
  fieldNotes: '',
}

function Metadata({ isOpen, caseName, initialMetadata, onSave, onCancel }: MetadataProps) {
  const [sex, setSex] = useState(initialMetadata?.sex ?? DEFAULT_METADATA.sex)
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(initialMetadata?.ageGroup ?? DEFAULT_METADATA.ageGroup)
  const [fieldNotes, setFieldNotes] = useState(initialMetadata?.fieldNotes ?? DEFAULT_METADATA.fieldNotes)

  useEffect(() => {
    if (!isOpen) return
    setSex(initialMetadata?.sex ?? DEFAULT_METADATA.sex)
    setAgeGroup(initialMetadata?.ageGroup ?? DEFAULT_METADATA.ageGroup)
    setFieldNotes(initialMetadata?.fieldNotes ?? DEFAULT_METADATA.fieldNotes)
  }, [isOpen, initialMetadata])

  if (!isOpen) return null

  function handleSave() {
    onSave({ sex, ageGroup, fieldNotes })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <Bone className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">Specimen metadata</h2>
                {caseName && (
                  <p className="truncate text-xs font-medium text-slate-500">{caseName}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
              onClick={onCancel}
              aria-label="Close specimen metadata"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
        <label className="block text-sm font-semibold text-slate-700">
          Sex
          <select
            value={sex}
            onChange={(event) => setSex(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            aria-label="Specimen sex"
          >
            <option value="unknown">Unknown</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Age group
          <select
            value={ageGroup}
            onChange={(event) => setAgeGroup(event.target.value as AgeGroup)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            aria-label="Specimen age group"
          >
            <option value="infant">Infant</option>
            <option value="child">Child</option>
            <option value="adolescent">Adolescent</option>
            <option value="adult">Adult</option>
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          General notes
          <textarea
            value={fieldNotes}
            onChange={(event) => setFieldNotes(event.target.value)}
            className="mt-1.5 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            rows={4}
            placeholder="Field notes, condition, provenance, etc."
            aria-label="Specimen field notes"
          />
        </label>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-100"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
            onClick={handleSave}
          >
            <Check className="h-4 w-4" />
            Save metadata
          </button>
        </div>
      </div>
    </div>
  )
}

export default Metadata
