import { useEffect, useRef } from 'react'
import skeletonFrontSource from '../assets/skeleton_front.svg?raw'
import type { SegmentState } from '../db/types'
import { prepareSkeletonFront, summariseZones, zoneStandIns } from '../pages/skeletonArtwork'

// Strip XML declaration and replace cls- to avoid style bleeding, then ready it
// so marks made in the skull, scapula and pelvis drawings land on it too.
const skeletonMarkup = prepareSkeletonFront(
  skeletonFrontSource.replace(/<\?xml[^?]*\?>/, '').replaceAll('cls-', 'preview-cls-'),
)

interface SkeletonPreviewProps {
  segmentStates?: Record<string, SegmentState>
  className?: string
}

export function SkeletonPreview({ segmentStates = {}, className = '' }: SkeletonPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const svg = container.querySelector('svg')
    if (!svg) return

    // Clear any previous preview states
    const previouslyColored = svg.querySelectorAll('[data-preview-state]')
    previouslyColored.forEach((el) => el.removeAttribute('data-preview-state'))

    // Apply states to matching segment/bone IDs
    for (const [segmentId, state] of Object.entries(segmentStates)) {
      if (!state) continue
      try {
        const target = svg.querySelector(`#${CSS.escape(segmentId)}`)
        if (target) {
          target.setAttribute('data-preview-state', state)
        }
      } catch (e) {
        console.warn(`Could not select segment ID "${segmentId}":`, e)
      }
    }

    // Bones drawn here only whole show what their zones add up to, as on the
    // skeleton page, unless they are marked in their own right.
    for (const [boneId, summary] of summariseZones(segmentStates)) {
      for (const target of zoneStandIns(svg, boneId)) {
        if (!target.closest('[data-preview-state]')) target.setAttribute('data-preview-state', summary)
      }
    }
  }, [segmentStates])

  return (
    <div
      ref={containerRef}
      className={`skeleton-preview pointer-events-none select-none ${className}`}
      dangerouslySetInnerHTML={{ __html: skeletonMarkup }}
    />
  )
}

export default SkeletonPreview
