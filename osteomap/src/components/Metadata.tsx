import { useEffect, useState } from 'react'
import type { AgeGroup } from '../db/types'

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded bg-white p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-3 text-lg font-bold">
          Specimen Metadata{caseName ? ` — ${caseName}` : ''}
        </h2>

        <label className="mb-2 block text-sm">
          Sex
          <select
            value={sex}
            onChange={(event) => setSex(event.target.value)}
            className="mt-1 w-full border px-2 py-1 text-sm"
            aria-label="Specimen sex"
          >
            <option value="unknown">unknown</option>
            <option value="female">female</option>
            <option value="male">male</option>
          </select>
        </label>

        <label className="mb-2 block text-sm">
          Age group
          <select
            value={ageGroup}
            onChange={(event) => setAgeGroup(event.target.value as AgeGroup)}
            className="mt-1 w-full border px-2 py-1 text-sm"
            aria-label="Specimen age group"
          >
            <option value="infant">infant</option>
            <option value="child">child</option>
            <option value="adolescent">adolescent</option>
            <option value="adult">adult</option>
          </select>
        </label>

        <label className="mb-3 block text-sm">
          General notes
          <textarea
            value={fieldNotes}
            onChange={(event) => setFieldNotes(event.target.value)}
            className="mt-1 w-full border px-2 py-1 text-sm"
            rows={4}
            placeholder="Field notes, condition, provenance, etc."
            aria-label="Specimen field notes"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button className="border px-3 py-1 text-sm" onClick={onCancel}>
            Cancel
          </button>
          <button className="border bg-gray-200 px-3 py-1 text-sm" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default Metadata
