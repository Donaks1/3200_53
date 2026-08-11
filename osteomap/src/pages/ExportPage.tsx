import type { NavigateFn } from './types'

function ExportPage({ onNavigate }: { onNavigate: NavigateFn }) {
  return (
    <div>
      <p>This is the export page — where the user will export their case.</p>
      <button type="button" onClick={() => onNavigate('home')}>
        Back to Home
      </button>
      <button type="button" onClick={() => onNavigate('skeleton')}>
        Go to Skeleton Page
      </button>
    </div>
  )
}

export default ExportPage
