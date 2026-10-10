import { useEffect, useId } from 'react'
import { X } from 'lucide-react'

interface InfoPopupProps {
  isOpen: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

// A read-only popup for reference material such as a colour key or help. It
// closes on Escape, on its close button, or on a tap outside it.
function InfoPopup({ isOpen, title, onClose, children }: InfoPopupProps) {
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white text-left shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 id={titleId} className="text-base font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 text-sm text-slate-700">{children}</div>
      </div>
    </div>
  )
}

export default InfoPopup
