import { useEffect, useRef, useState } from 'react'
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

// A bone is drawn as several numbered fragments, so a click lands on a path like
// l_femur_3 rather than on the femur. Dropping the trailing number gives the bone.
// Sometimes that bone is also a real group (l_femur wraps l_femur_1..11), and
// sometimes it only exists as a shared name (l_dist_pollex_1..3 are loose paths
// inside l_pollex) — treating the stripped name as the identity covers both.
const boneIdOf = (id: string) => id.replace(/_\d+$/, '')

function boneAt(target: Element, svg: SVGSVGElement): string | null {
  if (!svg.contains(target)) return null
  const labelled = target.closest('[id]')
  // Landing on the root means the click missed the skeleton.
  if (!labelled || labelled === svg) return null
  return boneIdOf(labelled.id)
}

// Match on the whole name, never a prefix: l_rib1 must not catch l_rib10..12.
function partsOfBone(diagram: HTMLElement, bone: string) {
  return [...diagram.querySelectorAll('[id]')].filter((el) => boneIdOf(el.id) === bone)
}

// l_femur -> "Left femur", r_iv-2 -> "Right iv 2"
function boneLabel(id: string) {
  const words = id
    .replace(/^l_/, 'left_')
    .replace(/^r_/, 'right_')
    .replaceAll(/[_-]/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function SkeletonPage({ onNavigate }: { onNavigate: NavigateFn }) {
  const diagramRef = useRef<HTMLDivElement>(null)
  const [selectedBone, setSelectedBone] = useState<string | null>(null)

  useEffect(() => {
    const diagram = diagramRef.current
    if (!diagram || !selectedBone) return
    const parts = partsOfBone(diagram, selectedBone)
    parts.forEach((part) => part.classList.add('is-selected'))
    return () => parts.forEach((part) => part.classList.remove('is-selected'))
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
          ? `Selected: ${boneLabel(selectedBone)} (${selectedBone})`
          : 'Click a bone to select it.'}
      </p>
      <div
        ref={diagramRef}
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
