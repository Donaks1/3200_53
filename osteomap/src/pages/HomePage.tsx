import type { NavigateFn } from './types'

function HomePage({ onNavigate }: { onNavigate: NavigateFn }) {
  return (
    <div>
      <p>This is the home page — where cases are created and managed.</p>
      <button type="button" onClick={() => onNavigate('skeleton')}>
        Go to Skeleton Page
      </button>
      <button type="button" onClick={() => onNavigate('export')}>
        Go to Export Page
      </button>
    </div>
  )
}

export default HomePage
