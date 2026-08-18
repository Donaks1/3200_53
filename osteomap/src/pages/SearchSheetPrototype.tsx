// Apple Maps-style shell prototype from commit b36ff46 (jimmy). This replaced
// the App.tsx router wholesale, which orphaned the three pages; the router has
// since been restored and this screen parked here verbatim so the design work
// survives. Not routed yet — the bone list below is placeholder data, and where
// this belongs (home, skeleton, or an app-wide shell) is still jimmy's call.
import { useEffect, useRef, useState } from 'react'
import { MapPinned, Search, X } from 'lucide-react'

function SearchSheetPrototype() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!sheetOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null

      if (!target || !sheetRef.current || sheetRef.current.contains(target)) {
        return
      }

      setSheetOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [sheetOpen])

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#f4f5f7] text-slate-800">
      <div className="relative h-full w-full">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#edf6ff_18%,_#f4f5f7_45%,_#eef2f7_100%)]" />

        <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-4">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm">
            <MapPinned className="h-4 w-4 text-sky-600" />
            <span className="text-sm font-semibold">OsteoMap</span>
          </div>
        </header>

        <main className="relative z-10 flex h-full items-center justify-center px-3 pb-[150px] pt-16">
          <div className="h-full w-full max-w-md rounded-[32px] border border-slate-200 bg-white/40 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm" />
        </main>

        <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
          <div ref={sheetRef} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 shadow-[0_-8px_28px_rgba(15,23,42,0.12)] backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                if (!sheetOpen) {
                  setSheetOpen(true)
                }
              }}
              className="flex w-full items-center gap-3 px-3 py-3 text-left transition-opacity duration-200 ease-out"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <Search className="h-5 w-5" />
              </div>

              <span className="flex-1 text-sm text-slate-500">Search bones...</span>

              {sheetOpen && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setSheetOpen(false)
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </button>

            <div
              className={[
                'overflow-hidden transition-all duration-300 ease-out',
                sheetOpen ? 'max-h-[38vh] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2',
              ].join(' ')}
            >
              <div className="border-t border-slate-200 bg-white px-3 pb-3 pt-2">
                <div className="space-y-2">
                  {[
                    'Skull',
                    'Femur',
                    'Tibia',
                    'Ribs',
                    'Pelvis',
                    'Humerus',
                    'Patella',
                    'Fibula',
                  ].map((bone) => (
                    <button
                      key={bone}
                      type="button"
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition-colors duration-200 hover:bg-sky-50"
                    >
                      <span className="text-sm font-medium text-slate-700">{bone}</span>
                      <span className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Bone</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchSheetPrototype
