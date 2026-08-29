import { useEffect, useState } from 'react'

interface TextInputPopupProps {
  isOpen: boolean
  title: string
  label?: string
  initialValue?: string
  placeholder?: string
  onSave: (value: string) => void
  onCancel: () => void
}

function TextInputPopup({
  isOpen,
  title,
  label,
  initialValue = '',
  placeholder,
  onSave,
  onCancel,
}: TextInputPopupProps) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (isOpen) setValue(initialValue)
  }, [isOpen, initialValue])

  if (!isOpen) return null

  function handleSave() {
    const trimmed = value.trim()
    if (!trimmed) return
    onSave(trimmed)
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
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        {label && (
          <label className="mb-1 block text-sm" htmlFor="text-input-popup-field">
            {label}
          </label>
        )}
        <input
          id="text-input-popup-field"
          type="text"
          value={value}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSave()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onCancel()
            }
          }}
          placeholder={placeholder}
          className="mb-3 w-full border px-2 py-1 text-sm"
        />
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

export default TextInputPopup
