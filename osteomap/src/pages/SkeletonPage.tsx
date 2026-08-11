import type { NavigateFn } from './types'

function SkeletonPage({ onNavigate }: { onNavigate: NavigateFn }) {
  return (
    <div>
      <p>This is the skeleton page — where the SVG diagram will sit and be edited.</p>
      <button type="button" onClick={() => onNavigate('home')}>
        Back to Home
      </button>
      <button type="button" onClick={() => onNavigate('export')}>
        Go to Export Page
      </button>
    </div>
  )
}

export default SkeletonPage
