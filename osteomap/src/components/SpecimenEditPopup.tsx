import { useEffect, useId, useState } from 'react'
import { Bone, Check, X } from 'lucide-react'
import type { AgeGroup } from '../db/types'
import { duplicateNameMessage, sameName } from '../db/names'
import { saveErrorMessage } from '../db/errors'

const SEX_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
]

const AGE_GROUP_OPTIONS: { value: AgeGroup; label: string }[] = [
  { value: 'infant', label: 'Infant' },
  { value: 'child', label: 'Child' },
  { value: 'adolescent', label: 'Adolescent' },
  { value: 'adult', label: 'Adult' },
]

const isAgeGroup = (value: string): value is AgeGroup => AGE_GROUP_OPTIONS.some((option) => option.value === value)

// What an edit saves. The age group is left out when the specimen's stored
// value isn't one of the four and wasn't changed, so saving never makes one up.
export interface SpecimenEdit {
  caseName: string
  sex: string
  ageGroup?: AgeGroup
  fieldNotes: string
}

interface SpecimenEditPopupProps {
  title: string
  idLabel: string
  location?: string
  specimen: { caseName: string; sex?: string | null; ageGroup?: string | null; fieldNotes?: string | null }
  // Whether another specimen in the same context already has this name.
  nameTaken: (name: string) => boolean
  // Rejects when the change couldn't be saved; the popup stays open to say why.
  onSave: (edit: SpecimenEdit) => Promise<void>
  onCancel: () => void
}

// Edits a specimen's ID and metadata. Mount it fresh for each specimen (give it
// a key), as it takes its starting values from the specimen once.
function SpecimenEditPopup({ title, idLabel, location, specimen, nameTaken, onSave, onCancel }: SpecimenEditPopupProps) {
  const titleId = useId()
  const nameMessageId = useId()
  const [name, setName] = useState(specimen.caseName)
  const [sex, setSex] = useState(specimen.sex || 'unknown')
  const [ageGroup, setAgeGroup] = useState<string>(specimen.ageGroup ?? '')
  const [notes, setNotes] = useState(specimen.fieldNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Values stored before these choices were enforced (free text typed into a
  // prompt, an unchecked import) are offered as they are, rather than shown as
  // a value they aren't.
  const storedSex =
    specimen.sex && !SEX_OPTIONS.some((option) => option.value === specimen.sex) ? specimen.sex : null
  const storedAgeGroup = specimen.ageGroup && isAgeGroup(specimen.ageGroup) ? null : (specimen.ageGroup ?? '')

  const trimmedName = name.trim()
  const nameMessage =
    trimmedName && !sameName(trimmedName, specimen.caseName) && nameTaken(trimmedName)
      ? duplicateNameMessage('specimen', trimmedName)
      : null
  const canSave = Boolean(trimmedName) && !nameMessage && !saving

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSave({
        caseName: trimmedName,
        sex,
        ...(isAgeGroup(ageGroup) ? { ageGroup } : {}),
        fieldNotes: notes,
      })
    } catch (error) {
      setSaveError(saveErrorMessage(error))
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
                <h2 id={titleId} className="text-base font-bold text-slate-900">{title}</h2>
                {location && <p className="truncate text-xs font-medium text-slate-500">{location}</p>}
              </div>
            </div>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
              onClick={onCancel}
              aria-label={`Close ${title.toLowerCase()}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              {idLabel}
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={nameMessage ? true : undefined}
                aria-describedby={nameMessage ? nameMessageId : undefined}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 aria-invalid:border-rose-400 aria-invalid:focus:ring-rose-100"
                placeholder={idLabel}
              />
            </label>
            {nameMessage && (
              <p id={nameMessageId} className="mt-1.5 text-xs font-medium text-rose-600">
                {nameMessage}
              </p>
            )}
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Sex
            <select
              value={sex}
              onChange={(event) => setSex(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              {storedSex && <option value={storedSex}>{storedSex}</option>}
              {SEX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Age group
            <select
              value={ageGroup}
              onChange={(event) => setAgeGroup(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              {storedAgeGroup !== null && (
                <option value={storedAgeGroup} disabled>
                  {storedAgeGroup || 'Not recorded'}
                </option>
              )}
              {AGE_GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            General notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1.5 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              rows={4}
              placeholder="Field notes, condition, provenance, etc."
            />
          </label>

          {saveError && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {saveError}
            </p>
          )}
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
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            onClick={handleSave}
            disabled={!canSave}
          >
            <Check className="h-4 w-4" />
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}

export default SpecimenEditPopup
