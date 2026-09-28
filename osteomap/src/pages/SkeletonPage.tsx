import { useEffect, useMemo, useRef, useState } from 'react'
import type { NavigateFn } from './types'
import skeletonFrontSource from '../assets/skeleton_front.svg?raw'
import skeletonBackSource from '../assets/skeleton_back.svg?raw'
import skullFrontSource from '../assets/skull_front.svg?raw'
import skullLeftSource from '../assets/skull_left.svg?raw'
import type { CaseRecord, SegmentState } from '../db/types'
import { ArrowLeft, ArrowRight, CheckCheck, Eye, FlipHorizontal, List, Redo2, RotateCcw, ScanFace, Search, Share2, SlidersHorizontal, StickyNote, Undo2, X } from 'lucide-react'
import { getCase, setAllSegmentStates, updateCaseMetadata } from '../db/caseOperation'
import NotesPopup from '../components/NotesPopup'



const skeletonFront = skeletonFrontSource
  .replace(/<\?xml[^?]*\?>/, '') // Strips the XML line of the svg file to prevent confusing HTML parser
  .replaceAll('cls-', 'front-cls-') // Stops the front SVG CSS from clashing with back view

const skeletonBack = skeletonBackSource
  .replace(/<\?xml[^?]*\?>/, '')
  .replaceAll('cls-', 'back-cls-')
  .replaceAll('id="l_femur-2"', 'id="r_femur"')
  .replaceAll('data-name="l_femur"', 'data-name="r_femur"')
  .replaceAll('id="r_tibia-2"', 'id="l_tibia"')
  .replaceAll('data-name="r_tibia"', 'data-name="l_tibia"')
  .replace(/id="l_femur_([0-9]+)-2"/g, 'id="r_femur_$1"')
  .replace(/data-name="l_femur_([0-9]+)"/g, 'data-name="r_femur_$1"')
  .replace(/id="r_tibia_([0-9]+)-2"/g, 'id="l_tibia_$1"')
  .replace(/data-name="r_tibia_([0-9]+)"/g, 'data-name="l_tibia_$1"')

const skullFront = skullFrontSource
  .replace(/<\?xml[^?]*\?>/, '')
  .replaceAll('cls-', 'skull-front-cls-')

const skullLeft = skullLeftSource
  .replace(/<\?xml[^?]*\?>/, '')
  .replaceAll('cls-', 'skull-left-cls-')

// Hoisted so the prop keeps the same object identity across renders. React 19
// compares dangerouslySetInnerHTML by reference, so an inline literal would
// rebuild the whole SVG on every state change — detaching the very node we just
// selected, and later throwing away any pan/zoom transform sitting on it.
const skeletonFrontMarkup = { __html: skeletonFront }
const skeletonBackMarkup = { __html: skeletonBack }
const skullFrontMarkup = { __html: skullFront }
const skullLeftMarkup = { __html: skullLeft }

type ActiveView = 'skeleton' | 'skeleton-back' | 'skull-front' | 'skull-left'

// Whether a click selects the whole bone or the single zone within it.
type SelectionMode = 'bone' | 'zone'

// What a click marks the segment as. The picker shows the colour itself rather
// than an icon, because the colour is the thing being applied.
type PaintState = 'present' | 'absent' | 'fragmentary'

const PAINT_OPTIONS: { state: PaintState; label: string; swatch: string }[] = [
  { state: 'present', label: 'Present', swatch: 'bg-emerald-500' },
  { state: 'absent', label: 'Absent', swatch: 'bg-red-500' },
  { state: 'fragmentary', label: 'Fragmentary', swatch: 'bg-blue-500' },
]

const paintLabel = (paint: PaintState) =>
  PAINT_OPTIONS.find((option) => option.state === paint)?.label ?? paint

// These two must stay inverses of each other: the first decides what gets
// written to the database, the second decides what gets repainted on load.
const SEGMENT_STATE_BY_PAINT: Record<PaintState, SegmentState> = {
  present: 'complete',
  absent: 'absent',
  fragmentary: 'fragmentary',
}

const PAINT_STATE_BY_SEGMENT: Partial<Record<SegmentState, PaintState>> = {
  complete: 'present',
  absent: 'absent',
  fragmentary: 'fragmentary',
}


// A marked segment and the colour it was marked with.
type PaintedSegment = { element: Element; paint: PaintState }

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
  // In either mode, individual teeth are selectable as distinct segments
  const tooth = target.closest('[id*="tooth"]') || (target.id?.includes('tooth') ? target : null)
  if (tooth) return tooth
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
  if (selected.id?.includes('tooth')) return boneLabel(selected.id)
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

// Switching modes keeps whatever is already painted, so the list holds a mix of
// bone groups and lone zone shapes. A group entry stands for every zone inside
// it, which is what makes these three helpers more than array operations: they
// keep exactly one entry per painted shape no matter which mode applied it.

// contains() counts the element itself, so this answers both "is it painted"
// and "is its bone painted", and returns the colour it is wearing either way.
// In bone mode, if child zones are painted, checking descendants allows bone mode
// to detect painted zones and de-select or recolor appropriately.
function paintOf(
  selected: PaintedSegment[],
  element: Element,
  activePaint?: PaintState,
): PaintState | null {
  const ancestorOrSelf = selected.find((entry) => entry.element.contains(element))
  if (ancestorOrSelf) return ancestorOrSelf.paint

  const childEntries = selected.filter(
    (entry) => element.contains(entry.element) && entry.element !== element,
  )
  if (childEntries.length > 0) {
    if (activePaint && childEntries.some((entry) => entry.paint === activePaint)) {
      return activePaint
    }
    return childEntries[0].paint
  }
  return null
}

// Painting a whole bone subsumes any of its zones already in the list. Callers
// clear the element first, so whatever covered it has already been dealt with.
function withPaint(
  selected: PaintedSegment[],
  element: Element,
  paint: PaintState,
): PaintedSegment[] {
  return [...selected.filter((entry) => !element.contains(entry.element)), { element, paint }]
}

// Clearing one zone is the hard direction: if its bone is in the list as a
// single entry, that entry has to break apart into everything under it except
// the shape being cleared, with the siblings keeping the colour they inherited.
// Walking up from the shape to the entry and keeping the siblings passed on the
// way does that at any depth, so carving a zone out of
// l_hand > l_pollex > l_dist_pollex works the same as out of l_femur.
function withoutPaint(selected: PaintedSegment[], element: Element): PaintedSegment[] {
  return selected.flatMap((entry) => {
    if (entry.element === element) return []
    // If entry is inside element (e.g. element is a bone group and entry is a child zone),
    // clearing the whole bone clears all child zones inside it.
    if (element.contains(entry.element)) return []
    if (!entry.element.contains(element)) return [entry]

    const remainder: PaintedSegment[] = []
    let node: Element = element
    while (node !== entry.element) {
      const parent: Element | null = node.parentElement
      if (!parent) break
      for (const child of parent.children) {
        if (child !== node) remainder.push({ element: child, paint: entry.paint })
      }
      node = parent
    }
    return remainder
  })
}

// Computes atomic updates to segmentStates in IndexedDB and caseData when selecting or
// de-selecting bones or individual zones.
// - Selecting/erasing a whole bone subsumes/clears all of its descendant zones.
// - Selecting/erasing a child zone breaks any stored ancestor bone into all other sibling zones,
//   preserving their paint state while isolating the target zone.
function computeUpdatedSegmentStates(
  currentStates: Record<string, SegmentState>,
  target: Element,
  svg: SVGSVGElement,
  newState: SegmentState | null,
  rootContainer?: HTMLElement | null,
): Record<string, SegmentState> {
  const next = { ...currentStates }

  // 1. Gather all descendant element IDs (child zones/subshapes)
  const descendantIds: string[] = []
  target.querySelectorAll('[id]').forEach((child) => {
    if (child.id && child.id !== target.id) {
      descendantIds.push(child.id)
    }
  })

  // 2. Gather ancestor bone group IDs up to the SVG root (excluding view wrappers and teeth containers)
  const ancestorBoneIds: string[] = []
  let curr: Element | null = target.parentElement
  while (curr && curr !== (svg as Element) && curr.tagName.toLowerCase() !== 'svg') {
    if (
      curr.id &&
      curr.tagName.toLowerCase() === 'g' &&
      curr.id !== 'skull' &&
      curr.id !== 'teeth' &&
      curr.id !== 'teeth_upper' &&
      curr.id !== 'teeth_lower'
    ) {
      ancestorBoneIds.push(curr.id)
    }
    curr = curr.parentElement
  }

  // 3. If any ancestor bone is currently stored in states, break it apart into sibling zones
  for (const ancestorId of ancestorBoneIds) {
    if (ancestorId in next) {
      const parentState = next[ancestorId]
      delete next[ancestorId]

      // Query parent group instances across mounted SVGs to find all sibling zones
      const parentElements = rootContainer
        ? Array.from(rootContainer.querySelectorAll<SVGElement>(`#${CSS.escape(ancestorId)}`))
        : Array.from(svg.querySelectorAll<SVGElement>(`#${CSS.escape(ancestorId)}`))

      for (const parentEl of parentElements) {
        parentEl.querySelectorAll('[id]').forEach((child) => {
          if (
            child.id &&
            child.id !== target.id &&
            child.id !== ancestorId &&
            !target.contains(child) &&
            child.tagName.toLowerCase() !== 'g'
          ) {
            next[child.id] = parentState
          }
        })
      }
    }
  }

  // 4. Update target and clean up descendants
  if (newState === null) {
    if (target.id) delete next[target.id]
    for (const descId of descendantIds) {
      delete next[descId]
    }
  } else {
    if (target.id) next[target.id] = newState
    for (const descId of descendantIds) {
      delete next[descId]
    }
  }

  return next
}

type SearchOption = {
  id: string
  label: string
}

function searchOptionsFromSvg(markup: string, mode: SelectionMode): SearchOption[] {
  const document = new DOMParser().parseFromString(markup, 'image/svg+xml')

  return [...document.querySelectorAll<SVGElement>('[id]')]
    .filter((element) => {
      const isGroup = element.tagName.toLowerCase() === 'g'
      const isTooth = element.id.includes('tooth')
      if (isTooth) return true
      return mode === 'bone' ? isGroup : !isGroup && element.closest('g') !== null
    })
    .map((element) => ({ id: element.id, label: boneLabel(element.id) }))
}

type TransitionPhase =
  | 'idle'
  | 'zooming-in'
  | 'fading-in'
  | 'fading-out'
  | 'zooming-out'
  | 'flipping-to-back'
  | 'flipping-to-front'

function getActiveLayerClass(view: ActiveView): string {
  if (view === 'skull-front' || view === 'skull-left') return '.skull-layer'
  if (view === 'skeleton-back') return '.skeleton-back-layer'
  return '.skeleton-front-layer'
}

function SkeletonPage({ caseId, onNavigate }: { caseId: string; onNavigate: NavigateFn }) {
  const [activeView, setActiveView] = useState<ActiveView>('skeleton')
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle')
  const [selected, setSelected] = useState<PaintedSegment[]>([])
  // These 2 lnes below are variable for the undo/redo button. 
  const [undoStack, setUndoStack] = useState<PaintedSegment[][]>([])
  const [redoStack, setRedoStack] = useState<PaintedSegment[][]>([])
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('bone')
  const [activePaint, setActivePaint] = useState<PaintState>('present')
  const [notesOpen, setNotesOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [caseData, setCaseData] = useState<CaseRecord | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const diagramRef = useRef<HTMLDivElement | null>(null)
  const searchSwipeStart = useRef<{ x: number; y: number } | null>(null)
  const searchSwipeTriggered = useRef(false)
  const isDragging = useRef(false)
  const resetTransformRef = useRef<() => void>(() => {})
  const restoredViewRef = useRef<{
    caseId: string
    activeView: ActiveView
    transitionPhase: TransitionPhase
  } | null>(null)


  const currentRawSvg = useMemo(() => {
    switch (activeView) {
      case 'skull-front':
        return skullFront
      case 'skull-left':
        return skullLeft
      case 'skeleton-back':
        return skeletonBack
      default:
        return skeletonFront
    }
  }, [activeView])

  const isSkullView = activeView === 'skull-front' || activeView === 'skull-left'
  const isSkullBarVisible =
    (isSkullView && transitionPhase !== 'fading-out' && transitionPhase !== 'zooming-out') ||
    transitionPhase === 'fading-in'

  const isSkeletonView = activeView === 'skeleton' || activeView === 'skeleton-back'
  const isSkeletonBarVisible =
    (isSkeletonView && transitionPhase !== 'zooming-in' && transitionPhase !== 'fading-in') ||
    transitionPhase === 'zooming-out'

  const boneOptions = useMemo(() => searchOptionsFromSvg(currentRawSvg, 'bone'), [currentRawSvg])
  const zoneOptions = useMemo(() => searchOptionsFromSvg(currentRawSvg, 'zone'), [currentRawSvg])

  const searchOptions = selectionMode === 'bone' ? boneOptions : zoneOptions
  const searchMatches = searchOptions
    .filter((bone) => {
      const query = searchTerm.toLowerCase()
      return bone.label.toLowerCase().includes(query) || bone.id.toLowerCase().includes(query)
    })
    .slice(0, 50)

  // Load the case record on mount.
  useEffect(() => {
    let active = true

    getCase(caseId).then((data) => {
      if (active) setCaseData(data ?? null)
    })

    return () => {
      active = false
    }
  }, [caseId])

  // Repaint the saved segments once the record and the SVG are both available.
  useEffect(() => {
    if (!caseData?.segmentStates || transitionPhase !== 'idle') return

    const restoreKey = { caseId: caseData.caseId, activeView, transitionPhase }
    const previousRestore = restoredViewRef.current
    if (
      previousRestore?.caseId === restoreKey.caseId &&
      previousRestore.activeView === restoreKey.activeView &&
      previousRestore.transitionPhase === restoreKey.transitionPhase
    ) {
      return
    }

    const svgs = diagramRef.current?.querySelectorAll<SVGSVGElement>('.diagram-layer svg') ?? []
    if (!svgs.length) return

    const restored = Array.from(svgs).flatMap((svg) =>
      Object.entries(caseData.segmentStates).flatMap(([segmentId, state]) => {
        const paint = state ? PAINT_STATE_BY_SEGMENT[state] : undefined
        // A state with no colour of its own isn't drawable, so it's skipped
        // rather than guessed at.
        if (!paint) return []

        try {
          const element = svg.querySelector(`#${CSS.escape(segmentId)}`)
          return element ? [{ element, paint }] : []
        } catch (e) {
          console.warn(`Could not select segment #${segmentId}:`, e)
          return []
        }
      })
    )

    setSelected(restored)
    setUndoStack([])
    setRedoStack([])
    restoredViewRef.current = restoreKey
  }, [caseData, activeView, transitionPhase])

  useEffect(() => {
    if (!sheetOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (target && sheetRef.current?.contains(target)) return
      setSheetOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [sheetOpen])

  // Pan & Zoom Engine: Exact cursor/finger focal point tracking for desktop and mobile
  useEffect(() => {
    if (transitionPhase !== 'idle') return

    const container = diagramRef.current
    if (!container) return

    const activeLayer = getActiveLayerClass(activeView)
    const svg = container.querySelector(`${activeLayer} svg`) as SVGSVGElement | null
    if (!svg) return

    let currentTransform = { x: 0, y: 0, scale: 1 }

    const applyTransform = (x: number, y: number, scale: number) => {
      currentTransform = { x, y, scale }
      svg.style.transformOrigin = '0 0'
      svg.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
    }

    let refocusTimer: ReturnType<typeof setTimeout> | null = null
    const refocus = () => {
      svg.style.display = 'none'
      void svg.getBoundingClientRect()
      svg.style.display = ''
    }

    const scheduleRefocus = () => {
      if (refocusTimer) clearTimeout(refocusTimer)
      refocusTimer = setTimeout(refocus, 80)
    }

    let momentumId: number | null = null
    const cancelMomentum = () => {
      if (momentumId !== null) {
        cancelAnimationFrame(momentumId)
        momentumId = null
      }
    }

    // Reset handler with smooth animation
    const reset = () => {
      cancelMomentum()
      const startX = currentTransform.x
      const startY = currentTransform.y
      const startScale = currentTransform.scale
      const startTime = performance.now()
      const duration = 250

      const animateReset = (now: number) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)

        const x = startX + (0 - startX) * ease
        const y = startY + (0 - startY) * ease
        const scale = startScale + (1 - startScale) * ease

        applyTransform(x, y, scale)

        if (progress < 1) {
          requestAnimationFrame(animateReset)
        } else {
          refocus()
        }
      }

      requestAnimationFrame(animateReset)
    }
    resetTransformRef.current = reset

    // Desktop Mouse Wheel Zoom: keeps the point under the mouse cursor perfectly stationary
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      cancelMomentum()

      const delta = event.deltaY === 0 && event.deltaX ? event.deltaX : event.deltaY
      if (delta === 0) return

      const factor = delta < 0 ? 1.15 : 1 / 1.15
      const newScale = Math.min(6, Math.max(0.5, currentTransform.scale * factor))
      if (newScale === currentTransform.scale) return

      const rect = svg.getBoundingClientRect()
      const scaleRatio = newScale / currentTransform.scale

      const newX = currentTransform.x - (scaleRatio - 1) * (event.clientX - rect.left)
      const newY = currentTransform.y - (scaleRatio - 1) * (event.clientY - rect.top)

      applyTransform(newX, newY, newScale)
      scheduleRefocus()
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    // Single-finger flick momentum
    const startMomentum = (initialVx: number, initialVy: number) => {
      cancelMomentum()
      let vx = initialVx
      let vy = initialVy
      let lastTime = performance.now()

      const step = (now: number) => {
        const dt = Math.min(now - lastTime, 32)
        lastTime = now

        const newX = currentTransform.x + vx * dt
        const newY = currentTransform.y + vy * dt
        applyTransform(newX, newY, currentTransform.scale)

        const friction = Math.pow(0.92, dt / 16)
        vx *= friction
        vy *= friction

        if (Math.hypot(vx, vy) > 0.04) {
          momentumId = requestAnimationFrame(step)
        } else {
          momentumId = null
          scheduleRefocus()
        }
      }

      momentumId = requestAnimationFrame(step)
    }

    // Touch & Pointer Gesture Handling
    let lastTouchDist = 0
    let lastTouchMid = { x: 0, y: 0 }
    let touchStartPos = { x: 0, y: 0 }
    let lastTouchPos = { x: 0, y: 0 }
    let recentMoves: { x: number; y: number; time: number }[] = []

    const onTouchStart = (e: TouchEvent) => {
      cancelMomentum()

      if (e.touches.length === 1) {
        const t = e.touches[0]
        touchStartPos = { x: t.clientX, y: t.clientY }
        lastTouchPos = { x: t.clientX, y: t.clientY }
        isDragging.current = false
        recentMoves = [{ x: t.clientX, y: t.clientY, time: performance.now() }]
      } else if (e.touches.length >= 2) {
        isDragging.current = true
        const t0 = e.touches[0]
        const t1 = e.touches[1]
        lastTouchDist = Math.max(Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY), 1)
        lastTouchMid = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0]
        const distMoved = Math.hypot(t.clientX - touchStartPos.x, t.clientY - touchStartPos.y)
        if (distMoved > 5) {
          isDragging.current = true
        }

        if (isDragging.current) {
          if (e.cancelable) e.preventDefault()
          const dx = t.clientX - lastTouchPos.x
          const dy = t.clientY - lastTouchPos.y
          applyTransform(currentTransform.x + dx, currentTransform.y + dy, currentTransform.scale)
          lastTouchPos = { x: t.clientX, y: t.clientY }

          const now = performance.now()
          recentMoves.push({ x: t.clientX, y: t.clientY, time: now })
          if (recentMoves.length > 5) recentMoves.shift()
        }
      } else if (e.touches.length >= 2) {
        if (e.cancelable) e.preventDefault()
        isDragging.current = true

        const t0 = e.touches[0]
        const t1 = e.touches[1]
        const currentDist = Math.max(Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY), 1)
        const currentMid = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 }

        const scaleRatio = currentDist / lastTouchDist
        const newScale = Math.min(6, Math.max(0.5, currentTransform.scale * scaleRatio))

        const rect = svg.getBoundingClientRect()
        const effectiveRatio = newScale / currentTransform.scale

        // Focal zoom centered on the exact midpoint between the two fingers
        const x1 = currentTransform.x - (effectiveRatio - 1) * (currentMid.x - rect.left)
        const y1 = currentTransform.y - (effectiveRatio - 1) * (currentMid.y - rect.top)

        // Midpoint translation tracking
        const dx = currentMid.x - lastTouchMid.x
        const dy = currentMid.y - lastTouchMid.y

        applyTransform(x1 + dx, y1 + dy, newScale)

        lastTouchDist = currentDist
        lastTouchMid = currentMid
        scheduleRefocus()
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0]
        lastTouchPos = { x: t.clientX, y: t.clientY }
        touchStartPos = { x: t.clientX, y: t.clientY }
        recentMoves = [{ x: t.clientX, y: t.clientY, time: performance.now() }]
      } else if (e.touches.length === 0) {
        if (isDragging.current && recentMoves.length >= 2) {
          const last = recentMoves[recentMoves.length - 1]
          const first = recentMoves[0]
          const dt = last.time - first.time
          if (dt > 10 && dt < 200) {
            const vx = (last.x - first.x) / dt
            const vy = (last.y - first.y) / dt
            const speed = Math.hypot(vx, vy)
            if (speed > 0.25) {
              startMomentum(vx, vy)
            }
          }
        }
        setTimeout(() => {
          isDragging.current = false
        }, 50)
      }
    }

    // Desktop Mouse Dragging
    let mouseStartPos = { x: 0, y: 0 }
    let lastMousePos = { x: 0, y: 0 }
    let isMouseDown = false

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      cancelMomentum()
      isMouseDown = true
      mouseStartPos = { x: e.clientX, y: e.clientY }
      lastMousePos = { x: e.clientX, y: e.clientY }
      isDragging.current = false
      recentMoves = [{ x: e.clientX, y: e.clientY, time: performance.now() }]
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !isMouseDown) return
      const distMoved = Math.hypot(e.clientX - mouseStartPos.x, e.clientY - mouseStartPos.y)
      if (distMoved > 5) {
        isDragging.current = true
      }

      if (isDragging.current) {
        const dx = e.clientX - lastMousePos.x
        const dy = e.clientY - lastMousePos.y
        applyTransform(currentTransform.x + dx, currentTransform.y + dy, currentTransform.scale)
        lastMousePos = { x: e.clientX, y: e.clientY }

        const now = performance.now()
        recentMoves.push({ x: e.clientX, y: e.clientY, time: now })
        if (recentMoves.length > 5) recentMoves.shift()
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !isMouseDown) return
      isMouseDown = false
      if (isDragging.current && recentMoves.length >= 2) {
        const last = recentMoves[recentMoves.length - 1]
        const first = recentMoves[0]
        const dt = last.time - first.time
        if (dt > 10 && dt < 200) {
          const vx = (last.x - first.x) / dt
          const vy = (last.y - first.y) / dt
          if (Math.hypot(vx, vy) > 0.25) {
            startMomentum(vx, vy)
          }
        }
      }
      setTimeout(() => {
        isDragging.current = false
      }, 50)
    }

    container.addEventListener('touchstart', onTouchStart, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: false })
    window.addEventListener('touchcancel', onTouchEnd, { passive: false })

    container.addEventListener('pointerdown', onPointerDown, { capture: true })
    window.addEventListener('pointermove', onPointerMove, { capture: true })
    window.addEventListener('pointerup', onPointerUp, { capture: true })
    window.addEventListener('pointercancel', onPointerUp, { capture: true })

    return () => {
      cancelMomentum()
      if (refocusTimer) clearTimeout(refocusTimer)
      resetTransformRef.current = () => {}
      container.removeEventListener('wheel', handleWheel)

      container.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)

      container.removeEventListener('pointerdown', onPointerDown, { capture: true })
      window.removeEventListener('pointermove', onPointerMove, { capture: true })
      window.removeEventListener('pointerup', onPointerUp, { capture: true })
      window.removeEventListener('pointercancel', onPointerUp, { capture: true })
    }
  }, [activeView, transitionPhase])

  // The CSS cascades the highlight from a group down onto its shapes, so the
  // class and the colour only ever need to go on the selection itself.
  useEffect(() => {
    selected.forEach((entry) => {
      entry.element.classList.add('is-selected')
      entry.element.setAttribute('data-paint', entry.paint)
    })
    return () =>
      selected.forEach((entry) => {
        entry.element.classList.remove('is-selected')
        entry.element.removeAttribute('data-paint')
      })
  }, [selected])

  function zoomToSkull() {
    if (transitionPhase !== 'idle') return

    // Clear any inline panzoom transform on the SVG before starting the CSS zoom
    const svg = diagramRef.current?.querySelector('.skeleton-layer svg') as HTMLElement | null
    if (svg) {
      svg.style.transform = ''
    }

    // Step 1: Smoothly zoom into the skull while keeping the skeleton 100% visible
    setTransitionPhase('zooming-in')

    // Step 2: At 550ms (as zoom gently settles), begin seamless cross-fade to skull front SVG
    setTimeout(() => {
      setTransitionPhase('fading-in')

      // Step 3: Allow 450ms for skull front SVG to dissolve into view over zoomed skull
      setTimeout(() => {
        setActiveView('skull-front')
        setTransitionPhase('idle')
      }, 450)
    }, 550)
  }

  function zoomBackToSkeleton() {
    if (transitionPhase !== 'idle') return

    // Clear any inline panzoom transform on the skeleton SVG so CSS keyframes zoom out cleanly
    const skeletonSvg = diagramRef.current?.querySelector('.skeleton-layer svg') as HTMLElement | null
    if (skeletonSvg) {
      skeletonSvg.style.transform = ''
    }

    // Immediately hide the skull layer and start zooming out skeleton and retracting toolbar simultaneously
    setTransitionPhase('zooming-out')

    // Settle back to standard full skeleton view once animations complete (500ms)
    setTimeout(() => {
      setActiveView('skeleton')
      setTransitionPhase('idle')
    }, 500)
  }

  function flipSkeletonView(targetView: 'skeleton' | 'skeleton-back') {
    if (transitionPhase !== 'idle' || activeView === targetView) return

    // Clear any inline panzoom transform on both skeleton SVGs before starting CSS 3D flip
    const svgs = diagramRef.current?.querySelectorAll<SVGElement>('.skeleton-layer svg') ?? []
    svgs.forEach((s) => {
      if (s instanceof HTMLElement || s instanceof SVGElement) {
        s.style.transform = ''
      }
    })

    const phase = targetView === 'skeleton-back' ? 'flipping-to-back' : 'flipping-to-front'
    setTransitionPhase(phase)

    // At 250ms (when outgoing layer is rotated 90deg edge-on), switch activeView to targetView
    // and let it rotate from 90deg to 0deg
    setTimeout(() => {
      setActiveView(targetView)
      // Allow remaining 250ms for target view to complete its 3D flip-in and settle
      setTimeout(() => {
        setTransitionPhase('idle')
      }, 250)
    }, 250)
  }

  function handleResetView() {
    if (transitionPhase !== 'idle') return

    // If currently in skull view or back view, return to anterior skeleton view
    if (activeView !== 'skeleton') {
      setActiveView('skeleton')
      setTransitionPhase('idle')
    }

    // Reset pan and zoom to default scale (1.0) and center position (0, 0)
    if (resetTransformRef.current) {
      resetTransformRef.current()
    }

    // Ensure all SVG layer transforms are clean and centered
    const svgs = diagramRef.current?.querySelectorAll<SVGElement>('.diagram-layer svg') ?? []
    svgs.forEach((s) => {
      if (s instanceof HTMLElement || s instanceof SVGElement) {
        s.style.transform = ''
      }
    })
  }

  async function handleSaveNotes(notes: string) {
    if (!caseData) return
    await updateCaseMetadata(caseId, { fieldNotes: notes })
    setCaseData({ ...caseData, fieldNotes: notes, dateModified: new Date().toISOString() })
    setNotesOpen(false)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }


  // Marks build up: each click paints another segment in the active colour, and
  // clicking one that already wears that colour wipes it, so the same button
  // both paints and erases. Clicking it in a different colour repaints instead.
  // A click that misses the skeleton is left alone — panning the diagram
  // shouldn't wipe out everything marked so far.
  async function handleDiagramClick(event: React.MouseEvent<HTMLDivElement>) {
    if (transitionPhase !== 'idle') return
    if (isDragging.current) return

    const activeLayer = getActiveLayerClass(activeView)
    const svg = event.currentTarget.querySelector(`${activeLayer} svg`) as SVGSVGElement | null
    if (!svg) return

    const rawTarget = event.target as Element

    // Clicking the skull in the anterior skeleton view triggers the smooth zoom into the skull
    if (activeView === 'skeleton') {
      const skullGroup = rawTarget.closest('#skull')
      if (skullGroup) {
        zoomToSkull()
        return
      }
    }

    const target = selectionAt(rawTarget, svg, selectionMode)
    if (!target) return

    // Clearing first is what lets a zone be repainted out of a whole bone: the
    // bone splits into its other zones, then this one goes back in on its own.
    const covering = paintOf(selected, target, activePaint)
    const erasing = covering === activePaint
    const matchingElements = target.id
      ? Array.from(
          diagramRef.current?.querySelectorAll<SVGElement>(
            `#${CSS.escape(target.id)}`
          ) ?? [],
        )
      : [target]

    setUndoStack((stack) => [...stack, selected])
    setRedoStack([])

    setSelected((current) => {
      let next = current

      for (const el of matchingElements) {
        const cleared = withoutPaint(next, el)
        next = erasing
          ? cleared
          : withPaint(cleared, el, activePaint)
      }

      return next
    })

    if (!target.id) return

    try {
      const newState = erasing ? null : SEGMENT_STATE_BY_PAINT[activePaint]
      const nextStates = computeUpdatedSegmentStates(
        caseData?.segmentStates ?? {},
        target,
        svg,
        newState,
        diagramRef.current,
      )
      setCaseData((prev) => (prev ? { ...prev, segmentStates: nextStates } : prev))
      await setAllSegmentStates(caseId, nextStates)
    } catch (err) {
      console.error('Failed to update segment state in DB:', err)
    }
  }

  function applySelectionChange(
    newSelected: PaintedSegment[]
  ) {
    setUndoStack((stack) => [...stack, selected])
    setRedoStack([])
    setSelected(newSelected)
  }

  async function persistSelection(selection: PaintedSegment[]) {
    const segmentStates: Record<string, SegmentState> = {}
    selection.forEach(({ element, paint }) => {
      if (element.id) segmentStates[element.id] = SEGMENT_STATE_BY_PAINT[paint]
    })
    setCaseData((prev) => (prev ? { ...prev, segmentStates } : prev))
    await setAllSegmentStates(caseId, segmentStates)
  }

  async function undo() {
    if (undoStack.length === 0) return

    const previous = undoStack[undoStack.length - 1]
    setUndoStack((stack) => stack.slice(0, -1))
    setRedoStack((stack) => [...stack, selected])
    setSelected(previous)

    try {
      await persistSelection(previous)
    } catch (err) {
      console.error('Failed to undo segment change:', err)
    }
  }

  async function redo() {
    if (redoStack.length === 0) return

    const next = redoStack[redoStack.length - 1]
    setRedoStack((stack) => stack.slice(0, -1))
    setUndoStack((stack) => [...stack, selected])
    setSelected(next)

    try {
      await persistSelection(next)
    } catch (err) {
      console.error('Failed to redo segment change:', err)
    }
  }

  async function handleSearchOption(option: SearchOption) {
    const activeLayer = getActiveLayerClass(activeView)
    const svg = diagramRef.current?.querySelector(`${activeLayer} svg`) as SVGSVGElement | null
    const match = [...(svg?.querySelectorAll<SVGElement>('[id]') ?? [])].find(
      (element) => element.id === option.id,
    )
    if (!svg || !match) return

    const selectedElement = selectionAt(match, svg, selectionMode)
    // Paints for the same reason a click does, so picking bones by name and by
    // tapping them can be mixed freely.
    if (selectedElement) {
      const matchingElements = selectedElement.id
        ? Array.from(
            diagramRef.current?.querySelectorAll<SVGElement>(
              `#${CSS.escape(selectedElement.id)}`
            ) ?? [],
          )
        : [selectedElement]

      setUndoStack((stack) => [...stack, selected])
      setRedoStack([])

      setSelected((current) => {
        let next = current

        for (const el of matchingElements) {
          next = withPaint(withoutPaint(next, el), el, activePaint)
        }

        return next
      })

      if (selectedElement.id) {
        try {
          const newState = SEGMENT_STATE_BY_PAINT[activePaint]
          const nextStates = computeUpdatedSegmentStates(
            caseData?.segmentStates ?? {},
            selectedElement,
            svg,
            newState,
            diagramRef.current,
          )
          setCaseData((prev) => (prev ? { ...prev, segmentStates: nextStates } : prev))
          await setAllSegmentStates(caseId, nextStates)
        } catch (err) {
          console.error('Failed to save segment state:', err)
        }
      }
    }
    setSearchTerm(option.label)
    setSheetOpen(false)
  }

  // The mode decides what the *next* click picks up, not what stays lit, so the
  // current selection carries across. Switching to zone mode is how you go back
  // and carve individual zones out of a bone you selected whole.
  function toggleSelectionMode() {
    setSelectionMode((mode) => (mode === 'bone' ? 'zone' : 'bone'))
  }

  async function selectAllBones() {
    const label = paintLabel(activePaint)
    const confirmed = window.confirm(
      `Are you sure you want to mark ALL bones in this view as "${label}"? This will overwrite current bone states.`
    )
    if (!confirmed) return

    const activeLayer = getActiveLayerClass(activeView)
    const svg = diagramRef.current?.querySelector(`${activeLayer} svg`) as SVGSVGElement | null
    if (!svg) return

    const bones = boneOptions
      .map((bone) => svg.querySelector(`#${CSS.escape(bone.id)}`))
      .filter((bone): bone is Element => bone !== null)
    applySelectionChange(bones.map((element) => ({ element, paint: activePaint })))

    const stateToSave = SEGMENT_STATE_BY_PAINT[activePaint]
    try {
      const newStates: Record<string, SegmentState> = { ...(caseData?.segmentStates ?? {}) }
      bones.forEach((bone) => {
        if (bone.id) {
          newStates[bone.id] = stateToSave
          // Subsume and remove any child zones under this bone
          bone.querySelectorAll('[id]').forEach((child) => {
            if (child.id && child.id !== bone.id) {
              delete newStates[child.id]
            }
          })
        }
      })
      await setAllSegmentStates(caseId, newStates)
      setCaseData((prev) => (prev ? { ...prev, segmentStates: newStates } : prev))
    } catch (err) {
      console.error('Failed to save all bones:', err)
    }
  }

  function handleSearchPointerDown(event: React.PointerEvent<Element>) {
    searchSwipeTriggered.current = false
    if (!sheetOpen) {
      searchSwipeStart.current = { x: event.clientX, y: event.clientY }
    }
  }

  function handleSearchPointerUp(event: React.PointerEvent<Element>) {
    const start = searchSwipeStart.current
    searchSwipeStart.current = null
    if (!start || sheetOpen) return

    const verticalDistance = start.y - event.clientY
    const horizontalDistance = Math.abs(start.x - event.clientX)
    if (verticalDistance > 40 && verticalDistance > horizontalDistance) {
      searchSwipeTriggered.current = true
      setSheetOpen(true)
    }
  }

  function toggleSearchSheet() {
    if (searchSwipeTriggered.current) {
      searchSwipeTriggered.current = false
      return
    }
    setSheetOpen((open) => !open)
  }

  return (
    <div className="skeleton-page">
      {/* Top Navigation & Info Header */}
      <header className="relative z-30 flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-3 py-2 shadow-xs backdrop-blur-md">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 transition-colors cursor-pointer"
          title="Back to Home"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Home</span>
        </button>

        <div className="flex flex-col items-center text-center px-2 min-w-0">
          <span className="truncate text-xs font-bold uppercase tracking-wider text-sky-700">
            {caseData?.caseName ?? 'Skeleton'}
          </span>
          <span aria-live="polite" className="truncate text-[11px] font-medium text-slate-500">
            {selected.length === 1
              ? `${selectionLabel(selected[0].element)} — ${paintLabel(selected[0].paint)}`
              : selected.length > 1
                ? `${selected.length} segments marked`
                : `Tap a ${selectionMode} to mark ${paintLabel(activePaint).toLowerCase()}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onNavigate('my-skeletons')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 transition-colors cursor-pointer"
            title="My Skeletons"
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">My Skeletons</span>
          </button>

          <button
            type="button"
            onClick={handleResetView}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 transition-colors cursor-pointer"
            title="Reset to Centered Front Skeleton View"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 transition-colors cursor-pointer"
            title="Skeleton Notes"
          >
            <StickyNote className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Notes</span>
          </button>


          <button
            type="button"
            onClick={() => onNavigate('export', caseId)}
            className="flex items-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 shadow-xs hover:bg-sky-100 transition-colors cursor-pointer"
            title="Export Record"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
            <ArrowRight className="h-3.5 w-3.5 hidden sm:inline" />
          </button>
        </div>

        {/* Skull View Mode Sub-Bar attached directly to bottom of header */}
        <div
          className={[
            'skull-sub-bar-wrapper',
            isSkullBarVisible ? 'is-visible' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden={!isSkullBarVisible}
        >
          <div className="skull-sub-bar-content flex items-center justify-between gap-2 border-b border-sky-100 bg-sky-50/95 px-3 py-1.5 backdrop-blur-md shadow-xs">
            <button
              type="button"
              onClick={zoomBackToSkeleton}
              className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700 shadow-xs hover:bg-sky-100 hover:text-sky-800 transition-all cursor-pointer"
              title="Return to full skeleton view"
              tabIndex={isSkullBarVisible ? 0 : -1}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Full Skeleton</span>
            </button>

            {/* View Toggle: Front vs Left */}
            <div className="flex items-center rounded-xl border border-sky-200/80 bg-white p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => setActiveView('skull-front')}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
                  activeView === 'skull-front'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50',
                ].join(' ')}
                title="View Anterior (Front) Skull"
                tabIndex={isSkullBarVisible ? 0 : -1}
              >
                <ScanFace className="h-3.5 w-3.5" />
                <span>Front View</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('skull-left')}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
                  activeView === 'skull-left'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50',
                ].join(' ')}
                title="View Lateral (Left) Skull"
                tabIndex={isSkullBarVisible ? 0 : -1}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Left View</span>
              </button>
            </div>

            <span className="hidden sm:inline-flex items-center rounded-lg bg-sky-100/80 px-2 py-1 text-[11px] font-semibold text-sky-800">
              {activeView === 'skull-front' ? 'Skull — Anterior' : 'Skull — Left Lateral'}
            </span>
          </div>
        </div>

        {/* Skeleton View Mode Sub-Bar attached directly to bottom of header */}
        <div
          className={[
            'skeleton-sub-bar-wrapper',
            isSkeletonBarVisible ? 'is-visible' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden={!isSkeletonBarVisible}
        >
          <div className="skeleton-sub-bar-content flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white/95 px-3 py-1.5 backdrop-blur-md shadow-xs">
            <button
              type="button"
              onClick={zoomToSkull}
              disabled={activeView !== 'skeleton'}
              className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700 shadow-xs hover:bg-sky-50 hover:text-sky-800 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
              title="Zoom to detailed skull view"
              tabIndex={isSkeletonBarVisible ? 0 : -1}
            >
              <ScanFace className="h-3.5 w-3.5 text-sky-600" />
              <span>Skull View</span>
            </button>

            {/* View Toggle: Front vs Back */}
            <div className="flex items-center rounded-xl border border-sky-200/80 bg-white p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => flipSkeletonView('skeleton')}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
                  activeView === 'skeleton'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50',
                ].join(' ')}
                title="View Anterior (Front) Skeleton"
                tabIndex={isSkeletonBarVisible ? 0 : -1}
              >
                <ScanFace className="h-3.5 w-3.5" />
                <span>Front View</span>
              </button>
              <button
                type="button"
                onClick={() => flipSkeletonView('skeleton-back')}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
                  activeView === 'skeleton-back'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50',
                ].join(' ')}
                title="View Posterior (Back) Skeleton"
                tabIndex={isSkeletonBarVisible ? 0 : -1}
              >
                <FlipHorizontal className="h-3.5 w-3.5" />
                <span>Back View</span>
              </button>
            </div>

            <span className="hidden sm:inline-flex items-center rounded-lg bg-sky-100/80 px-2 py-1 text-[11px] font-semibold text-sky-800">
              {activeView === 'skeleton' ? 'Skeleton — Anterior' : 'Skeleton — Posterior'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Skeleton / Skull Diagram */}
      <div
        ref={diagramRef}
        className={[
          'skeleton-diagram',
          isSkullView && transitionPhase === 'idle' ? 'skull-view' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="img"
        aria-label={
          activeView === 'skeleton'
            ? 'Anterior view of the human skeleton'
            : activeView === 'skeleton-back'
              ? 'Posterior view of the human skeleton'
              : activeView === 'skull-front'
                ? 'Anterior view of the human skull'
                : 'Left lateral view of the human skull'
        }
        onClick={handleDiagramClick}
      >
        {/* Layer 1: Skeleton Front View */}
        <div
          className={[
            'diagram-layer skeleton-layer skeleton-front-layer',
            transitionPhase === 'zooming-in' ? 'layer-zooming-in' : '',
            transitionPhase === 'fading-in' ? 'layer-zoomed-fade-out' : '',
            transitionPhase === 'fading-out' ? 'layer-zoomed-hold' : '',
            transitionPhase === 'zooming-out' ? 'layer-zooming-out' : '',
            transitionPhase === 'flipping-to-back' ? 'layer-flip-out-front' : '',
            transitionPhase === 'flipping-to-front' ? 'layer-flip-in-front' : '',
            activeView !== 'skeleton' && transitionPhase === 'idle' ? 'layer-hidden' : '',
            activeView !== 'skeleton' && transitionPhase !== 'flipping-to-front' && transitionPhase !== 'flipping-to-back' && transitionPhase !== 'zooming-in' && transitionPhase !== 'fading-in' && transitionPhase !== 'fading-out' && transitionPhase !== 'zooming-out' ? 'layer-hidden' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          dangerouslySetInnerHTML={skeletonFrontMarkup}
        />

        {/* Layer 2: Skeleton Back View */}
        <div
          className={[
            'diagram-layer skeleton-layer skeleton-back-layer',
            transitionPhase === 'flipping-to-back' ? 'layer-flip-in-back' : '',
            transitionPhase === 'flipping-to-front' ? 'layer-flip-out-back' : '',
            activeView !== 'skeleton-back' && transitionPhase === 'idle' ? 'layer-hidden' : '',
            activeView !== 'skeleton-back' && transitionPhase !== 'flipping-to-back' && transitionPhase !== 'flipping-to-front' ? 'layer-hidden' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          dangerouslySetInnerHTML={skeletonBackMarkup}
        />

        {/* Layer 3: Detailed Skull View (Front or Left) */}
        <div
          className={[
            'diagram-layer skull-layer',
            isSkeletonView && transitionPhase === 'idle' ? 'layer-hidden' : '',
            transitionPhase === 'zooming-in' ? 'layer-hidden' : '',
            transitionPhase === 'fading-in' ? 'layer-fade-in' : '',
            transitionPhase === 'fading-out' ? 'layer-fade-out' : '',
            transitionPhase === 'zooming-out' ? 'layer-hidden' : '',
            transitionPhase === 'flipping-to-back' || transitionPhase === 'flipping-to-front' ? 'layer-hidden' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          dangerouslySetInnerHTML={activeView === 'skull-left' ? skullLeftMarkup : skullFrontMarkup}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        <div
          ref={sheetRef}
          className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 p-2 shadow-[0_-8px_28px_rgba(15,23,42,0.12)] backdrop-blur-md"
        >
          <div
            className={[
              'overflow-hidden transition-all duration-300 ease-out',
              toolsOpen ? 'max-h-48 translate-y-0 opacity-100' : 'max-h-0 -translate-y-2 opacity-0',
            ].join(' ')}
          >
            <div className="mb-2 space-y-2 border-b border-slate-200 px-1 pb-2">
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-2 py-3 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:text-slate-400"
                  aria-label="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                  Undo
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-2 py-3 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:text-slate-400"
                  aria-label="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                  Redo
                </button>
                <button
                  type="button"
                  onClick={toggleSelectionMode}
                  aria-pressed={selectionMode === 'zone'}
                  className="rounded-2xl bg-sky-100 px-2 py-3 text-xs font-semibold text-sky-700"
                >
                  Select: {selectionMode === 'bone' ? 'Bone' : 'Zone'}
                </button>
                <button
                  type="button"
                  onClick={selectAllBones}
                  disabled={selectionMode !== 'bone'}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-100 px-2 py-3 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  aria-label="Select all bones"
                >
                  <CheckCheck className="h-4 w-4" />
                  All bones
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Mark segments as">
                {PAINT_OPTIONS.map((option) => (
                  <button
                    key={option.state}
                    type="button"
                    onClick={() => setActivePaint(option.state)}
                    aria-pressed={activePaint === option.state}
                    className={[
                      'flex items-center justify-center gap-2 rounded-2xl px-2 py-3 text-xs font-semibold transition-colors duration-200',
                      activePaint === option.state
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600',
                    ].join(' ')}
                  >
                    <span
                      className={`h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10 ${option.swatch}`}
                    />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {sheetOpen && (
            <div className="mb-2 flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
              <Search className="h-5 w-5 shrink-0 text-sky-700" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search bones..."
                aria-label="Search bones"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false)
                  setSearchTerm('')
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-600"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div
            className={[
              'overflow-hidden transition-all duration-300 ease-out',
              sheetOpen ? 'max-h-[38vh] translate-y-0 opacity-100' : 'max-h-0 -translate-y-2 opacity-0',
            ].join(' ')}
          >
            <div className="border-t border-slate-200 bg-white px-3 pb-3 pt-2">
              <div className="search-results-scrollbar max-h-[32vh] space-y-2 overflow-y-auto">
                {searchMatches.length > 0 ? (
                  searchMatches.map((bone) => (
                    <button
                      key={bone.id}
                      type="button"
                      onClick={() => handleSearchOption(bone)}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition-colors duration-200 hover:bg-sky-50"
                    >
                      <span className="text-sm font-medium text-slate-700">{bone.label}</span>
                      <span className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
                        {selectionMode === 'bone' ? 'Bone' : 'Zone'}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-sm text-slate-500">No bones found.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setToolsOpen((open) => !open)}
              aria-expanded={toolsOpen}
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Tools
            </button>
            <button
              type="button"
              onClick={toggleSearchSheet}
              onPointerDown={handleSearchPointerDown}
              onPointerUp={handleSearchPointerUp}
              onPointerCancel={() => {
                searchSwipeStart.current = null
              }}
              className="flex min-w-0 flex-1 touch-pan-y items-center gap-2 rounded-2xl bg-sky-100 px-4 py-3 text-left text-sm font-medium text-sky-700"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Search bones</span>
            </button>
          </div>
        </div>
      </div>
      <NotesPopup
	      isOpen={notesOpen}
        caseName={caseData?.caseName}
        initialValue={caseData?.fieldNotes ?? ''}
        onSave={handleSaveNotes}
        onCancel={() => {
          setNotesOpen(false)
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        }}
      />
    </div>
  )
}

export default SkeletonPage
