import { useEffect, useState } from 'react'
import type { NavigateFn } from './types'
import skeletonFrontSource from '../assets/skeleton_front.svg?raw'


const skeletonFront = skeletonFrontSource
  .replace(/<\?xml[^?]*\?>/, '') // Strips the XML line of the svg file to prevent confusing HTML parser
  .replaceAll('cls-', 'front-cls-') // Stops the front SVG CSS from clashing with back view

// Hoisted so the prop keeps the same object identity across renders. React 19
// compares dangerouslySetInnerHTML by reference, so an inline literal would
// rebuild the whole SVG on every state change — detaching the very node we just
// selected, and later throwing away any pan/zoom transform sitting on it.
const skeletonFrontMarkup = { __html: skeletonFront }

// Whether a click selects the whole bone or the single zone within it.
type SelectionMode = 'bone' | 'zone'

// A bone is a <g> and its zones are the shapes drawn inside it. Groups are never
// painted and so can never be the click target themselves — the click always
// lands on a zone shape, which makes both modes fall out of the same event:
// keep the target for a zone, or step out to the first enclosing group for a
// bone. Depth doesn't matter, so l_femur > path and
// l_hand > l_pollex > l_dist_pollex > path both resolve correctly.
function selectionAt(
  target: Element,
  svg: SVGSVGElement,
  mode: SelectionMode,
): Element | null {
  // Landing outside the drawing, or on the root, means the click missed the skeleton.
  if (!svg.contains(target) || target === svg) return null
  return mode === 'zone' ? target : target.closest('g')
}

// The bone a selection belongs to. closest() counts the element itself, so this
// returns the group unchanged in bone mode and its parent group in zone mode.
const boneOf = (selected: Element) => selected.closest('g')

// l_femur -> "Left femur", r_iv-2 -> "Right iv 2".
// This part is literally just to generate full bone name from abbreviation.
function boneLabel(id: string) {
  const words = id
    .replace(/^l_/, 'left_')
    .replace(/^r_/, 'right_')
    .replaceAll(/[_-]/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function selectionLabel(selected: Element) {
  const bone = boneOf(selected)
  // A shape with no group around it isn't a finished bone yet, so all we can
  // report is whatever it happens to be called.
  if (!bone) return boneLabel(selected.id) || 'Ungrouped shape'

  const name = boneLabel(bone.id) || 'Unnamed bone'
  if (selected === bone) return name
  // Zone shapes don't need names of their own, so identify them by position.
  const index = [...bone.children].indexOf(selected) + 1
  return `${name} — zone ${index} of ${bone.children.length}`
}

function SkeletonPage({ onNavigate }: { onNavigate: NavigateFn }) {
  const [selected, setSelected] = useState<Element | null>(null)
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('bone')

  // The CSS cascades the highlight from a group down onto its shapes, so the
  // class only ever needs to go on the selection itself.
  useEffect(() => {
    if (!selected) return
    selected.classList.add('is-selected')
    return () => selected.classList.remove('is-selected')
  }, [selected])

  function handleDiagramClick(event: React.MouseEvent<HTMLDivElement>) {
    const svg = event.currentTarget.querySelector('svg')
    if (!svg) return
    setSelected(selectionAt(event.target as Element, svg, selectionMode))
  }

  // Clearing on switch avoids leaving a bone lit up while the bar reads "zone",
  // which makes it look like the toggle didn't take.
  function toggleSelectionMode() {
    setSelectionMode((mode) => (mode === 'bone' ? 'zone' : 'bone'))
    setSelected(null)
  }

  return (
    <div className="skeleton-page">
      <p>This is the skeleton page — where the SVG diagram will sit and be edited.</p>
      <p aria-live="polite">
        {selected
          ? `Selected: ${selectionLabel(selected)}`
          : `Click a ${selectionMode} to select it.`}
      </p>
      <div
        className="skeleton-diagram"
        role="img"
        aria-label="Anterior view of the human skeleton"
        onClick={handleDiagramClick}
        dangerouslySetInnerHTML={skeletonFrontMarkup}
      />
      <button type="button" onClick={() => onNavigate('home')}>
        Back to Home
      </button>
      <button type="button" onClick={() => onNavigate('export')}>
        Go to Export Page
      </button>
      <div className="task-bar" role="toolbar" aria-label="Skeleton tools">
        <button type="button" onClick={toggleSelectionMode}>
          Selecting: {selectionMode === 'bone' ? 'Whole bone' : 'Bone zone'}
        </button>
      </div>
    </div>
  )
}

export default SkeletonPage
