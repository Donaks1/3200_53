import { useState } from 'react'
import InfoPopup from './InfoPopup'

type Platform = 'ios' | 'android' | 'computer'

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'ios', label: 'iPhone & iPad' },
  { id: 'android', label: 'Android' },
  { id: 'computer', label: 'Computer' },
]

// Opens on the instructions for the device in hand. iPads report themselves
// as Macs, so a Mac with a touch screen is taken to be an iPad.
function detectPlatform(): Platform {
  const agent = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(agent)) return 'android'
  return 'computer'
}

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

interface HelpPopupProps {
  isOpen: boolean
  onClose: () => void
}

function HelpPopup({ isOpen, onClose }: HelpPopupProps) {
  const [platform, setPlatform] = useState<Platform>(detectPlatform)

  return (
    <InfoPopup isOpen={isOpen} title="Help: install OsteoMap" onClose={onClose}>
      <div className="space-y-4">
        <p>
          Install OsteoMap to open it from its own icon, full screen, and to keep working without an internet
          connection once it has loaded.
        </p>

        {isInstalled() && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            You're already using the installed app.
          </p>
        )}

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Device">
          {PLATFORMS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={platform === option.id}
              onClick={() => setPlatform(option.id)}
              className={[
                'min-w-0 rounded-lg px-2 py-1.5 text-xs font-semibold leading-tight transition-colors cursor-pointer',
                platform === option.id ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              {/* Sized on a span: the global `button { font: inherit }` rule outranks text utilities on buttons. */}
              <span className="text-xs">{option.label}</span>
            </button>
          ))}
        </div>

        {platform === 'ios' && (
          <section className="space-y-3" role="tabpanel">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Open OsteoMap in Safari.</li>
              <li>
                Tap the <b>Share</b> button (the square with an arrow pointing up).
              </li>
              <li>
                Scroll down and tap <b>Add to Home Screen</b>.
              </li>
              <li>
                Tap <b>Add</b>.
              </li>
            </ol>
            <p className="text-xs text-slate-500">
              On iOS 16.4 or later you can also do this from the share menu in Chrome or Edge.
            </p>
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              On iPhone and iPad the installed app keeps its own records, separate from Safari's. If you've already
              recorded skeletons in Safari, export them there and import them into the app with Import / Export.
            </p>
          </section>
        )}

        {platform === 'android' && (
          <section className="space-y-3" role="tabpanel">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Open OsteoMap in Chrome.</li>
              <li>
                Tap the <b>⋮</b> menu at the top right.
              </li>
              <li>
                Tap <b>Install app</b> (on some phones it's <b>Add to Home screen</b>), then <b>Install</b>.
              </li>
            </ol>
            <p className="text-xs text-slate-500">
              In Samsung Internet, tap the <b>☰</b> menu, then <b>Add page to</b> › <b>Home screen</b>.
            </p>
          </section>
        )}

        {platform === 'computer' && (
          <section className="space-y-3" role="tabpanel">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Open OsteoMap in Chrome or Edge, on Windows, Mac, Chromebook or Linux.</li>
              <li>
                Click the <b>install</b> icon at the right-hand end of the address bar (a screen with a down arrow).
                Or open the browser's menu and choose <b>Install OsteoMap</b>: in Chrome it's under{' '}
                <b>Cast, save and share</b>, in Edge under <b>Apps</b>.
              </li>
              <li>
                Click <b>Install</b>. OsteoMap opens in its own window and appears with your other apps.
              </li>
            </ol>
            <p className="text-xs text-slate-500">
              In Safari on a Mac (macOS Sonoma or later), choose <b>File</b> › <b>Add to Dock</b>.
            </p>
          </section>
        )}

        <div className="space-y-1 border-t border-slate-200 pt-3 text-xs text-slate-500">
          <p>Records are saved on the device you make them on. Use Import / Export to back them up or move them.</p>
          <p>The installed app updates itself the next time it's opened with an internet connection.</p>
        </div>
      </div>
    </InfoPopup>
  )
}

export default HelpPopup
