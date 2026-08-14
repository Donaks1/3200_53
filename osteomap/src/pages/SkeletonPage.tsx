import { useEffect, useState } from 'react'
import type { NavigateFn } from './types'
import skeletonFrontSource from '../assets/skeleton_front.svg?raw'


const skeletonFront = skeletonFrontSource
  .replace(/<\?xml[^?]*\?>/, '') // Strips the XML line of the svg file to prevent confusing HTML parser
  .replaceAll('cls-', 'front-cls-') // Stops the front SVG CSS from clashing with back view

// A bone is a <g> and its zones are the shapes drawn inside it, so the bone is
// just the nearest enclosing group. Groups are never painted and so can never be
// the click target themselves — the click always lands on a zone shape and walks
// out from there, stopping at the first group it meets. That makes this work at
// any depth: l_femur > path, but equally l_hand > l_pollex > l_dist_pollex > path.
function boneAt(target: Element, svg: SVGSVGElement): SVGGElement | null {
  // Landing outside the drawing, or on the root, means the click missed the skeleton.
  if (!svg.contains(target)) return null
  return target.closest('g')
}

// l_femur -> "Left femur", r_iv-2 -> "Right iv 2".
// This part is literally just to generate full bone name from abbreviation.
function boneLabel(id: string) {
  const words = id
    .replace(/^l_/, 'left_')
    .replace(/^r_/, 'right_')
    .replaceAll(/[_-]/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function SkeletonPage({ onNavigate }: { onNavigate: NavigateFn }) {
  const [selectedBone, setSelectedBone] = useState<SVGGElement | null>(null)

  // The CSS cascades the highlight from a group down onto its shapes, so the
  // class only ever needs to go on the bone itself.
  useEffect(() => {
    if (!selectedBone) return
    selectedBone.classList.add('is-selected')
    return () => selectedBone.classList.remove('is-selected')
  }, [selectedBone])

  function handleDiagramClick(event: React.MouseEvent<HTMLDivElement>) {
    const svg = event.currentTarget.querySelector('svg')
    if (!svg) return
    setSelectedBone(boneAt(event.target as Element, svg))
  }

  return (
    <div>
      <p>This is the skeleton page — where the SVG diagram will sit and be edited.</p>
      <p aria-live="polite">
        {selectedBone
          ? `Selected: ${boneLabel(selectedBone.id)} (${selectedBone.id})`
          : 'Click a bone to select it.'}
      </p>
      <div
        className="skeleton-diagram"
        role="img"
        aria-label="Anterior view of the human skeleton"
        onClick={handleDiagramClick}
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
