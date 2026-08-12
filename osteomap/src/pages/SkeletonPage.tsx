import type { NavigateFn } from './types'
import skeletonFrontSource from '../assets/skeleton_front.svg?raw'

// The SVG is inlined rather than shown through an <img> so each bone keeps its
// own element in the DOM, ready to be selected and edited.
// It ships with a <style> block of generic .cls-N rules that land in the
// document once inlined, so they are namespaced per view to keep the back view
// from clashing with the front when it is added.
const skeletonFront = skeletonFrontSource
  .replace(/<\?xml[^?]*\?>/, '')
  .replaceAll('cls-', 'front-cls-')

function SkeletonPage({ onNavigate }: { onNavigate: NavigateFn }) {
  return (
    <div>
      <p>This is the skeleton page — where the SVG diagram will sit and be edited.</p>
      <div
        className="skeleton-diagram"
        role="img"
        aria-label="Anterior view of the human skeleton"
        dangerouslySetInnerHTML={{ __html: skeletonFront }}
      />
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
