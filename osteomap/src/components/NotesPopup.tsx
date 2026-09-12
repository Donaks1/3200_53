import { useEffect, useState } from 'react'

interface NotesPopupProps {
  isOpen: boolean
  caseName?: string
  initialValue?: string
  onSave: (notes: string) => void
  onCancel: () => void
}





function NotesPopup({ isOpen, caseName, initialValue = '', onSave, onCancel }: NotesPopupProps) {
  const [notes, setNotes] = useState(initialValue)

  useEffect(() => {
    if (isOpen) setNotes(initialValue)
  }, [isOpen, initialValue])

  if (!isOpen) return null

  function handleSave() {
    onSave(notes)
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
          Notes{caseName ? ` — ${caseName}` : ''}
        </h2>

        <label className="mb-3 block text-sm">
          <textarea
            value={notes}
            autoFocus
            onChange={(event) => setNotes(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                onCancel()
              }
            }}
            className="mt-1 w-full border px-2 py-1 text-sm"
            rows={6}
            placeholder="Field notes, condition, provenance, etc."
            aria-label="Skeleton notes"
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

export default NotesPopup
