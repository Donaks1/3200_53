import { CircleAlert, X } from 'lucide-react'

interface ErrorBannerProps {
  message: string | null
  onDismiss: () => void
}

// Something that went wrong and needs to be seen, such as a change that wasn't
// saved. It sits above everything, dialogs included, until it is dismissed.
function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  if (!message) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[max(12px,env(safe-area-inset-top))]">
      <div
        role="alert"
        className="pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-left shadow-lg"
      >
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm font-medium text-rose-800">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-100 cursor-pointer"
          aria-label="Dismiss message"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default ErrorBanner
