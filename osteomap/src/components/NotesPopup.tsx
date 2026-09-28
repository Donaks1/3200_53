import { useEffect, useRef, useState } from 'react'

interface NotesPopupProps {
  isOpen: boolean
  caseName?: string
  initialValue?: string
  onSave: (notes: string) => void
  onCancel: () => void
}

function NotesPopup({ isOpen, caseName, initialValue = '', onSave, onCancel }: NotesPopupProps) {
  const [notes, setNotes] = useState(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (isOpen) setNotes(initialValue)
  }, [isOpen, initialValue])

  if (!isOpen) return null

  function closeAndReset(callback: () => void) {
    if (textareaRef.current) {
      textareaRef.current.blur()
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    callback()
  }

  function handleSave() {
    closeAndReset(() => onSave(notes))
  }

  function handleCancel() {
    closeAndReset(onCancel)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleCancel}
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
            ref={textareaRef}
            value={notes}
            autoFocus
            onChange={(event) => setNotes(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                handleCancel()
              }
            }}
            className="mt-1 w-full border px-2 py-1 text-base sm:text-sm"
            rows={6}
            placeholder="Field notes, condition, provenance, etc."
            aria-label="Skeleton notes"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button className="border px-3 py-1 text-sm" onClick={handleCancel}>
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
