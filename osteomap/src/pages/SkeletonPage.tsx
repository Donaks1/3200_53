import { useEffect, useRef, useState } from 'react'
import panzoom from '@panzoom/panzoom'
import type { NavigateFn } from './types'
import skeletonFrontSource from '../assets/skeleton_front.svg?raw'
import { CheckCheck, Redo2, Search, SlidersHorizontal, Undo2, X } from 'lucide-react'
import { getCase, updateSegmentState } from '../db/caseOperation'
import type { CaseRecord, SegmentState } from '../db/types'


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

type SearchOption = {
  id: string
  label: string
}

function searchOptionsFromSvg(markup: string, mode: SelectionMode): SearchOption[] {
  const document = new DOMParser().parseFromString(markup, 'image/svg+xml')

  return [...document.querySelectorAll<SVGElement>('[id]')]
    .filter((element) => {
      const isGroup = element.tagName.toLowerCase() === 'g'
      return mode === 'bone' ? isGroup : !isGroup && element.closest('g') !== null
    })
    .map((element) => ({ id: element.id, label: boneLabel(element.id) }))
}

function SkeletonPage({ caseId, onNavigate }: { caseId: string; onNavigate: NavigateFn }) {
  const [selected, setSelected] = useState<Element[]>([])
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('bone')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  //important list of the bones found in the SVG.
  const [boneOptions] = useState(() => searchOptionsFromSvg(skeletonFront, 'bone'))
  const [zoneOptions] = useState(() => searchOptionsFromSvg(skeletonFront, 'zone'))
  const [caseData, setCaseData] = useState<CaseRecord | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const diagramRef = useRef<HTMLDivElement | null>(null)
  const searchSwipeStart = useRef<{ x: number; y: number } | null>(null)
  const searchSwipeTriggered = useRef(false)

  const searchOptions = selectionMode === 'bone' ? boneOptions : zoneOptions
  const searchMatches = searchOptions
    .filter((bone) => {
      const query = searchTerm.toLowerCase()
      return bone.label.toLowerCase().includes(query) || bone.id.toLowerCase().includes(query)
    })
    .slice(0, 50)

  // Load the case saved data on mount
  useEffect(() => {
    getCase(caseId).then((data) => setCaseData(data ?? null))
  }, [caseId])

  useEffect(() => {
    const svg = diagramRef.current?.querySelector('svg')
    if (!svg || !caseData) return
    for (const [segmentId, state] of Object.entries(caseData.segmentStates)) {
      svg.querySelector(`#${segmentId}`)?.setAttribute('data-state', state)
    }
  }, [caseData])

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

  useEffect(() => {
    const svg = diagramRef.current?.querySelector('svg')
    if (!svg) return

    const zoom = panzoom(svg, {
      maxScale: 4,
      minScale: 0.5,
      step: 0.25,
    })

    return () => zoom.destroy()
  }, [])

  // The CSS cascades the highlight from a group down onto its shapes, so the
  // class only ever needs to go on the selection itself.
  useEffect(() => {
    selected.forEach((element) => element.classList.add('is-selected'))
    return () => selected.forEach((element) => element.classList.remove('is-selected'))
  }, [selected])

  // Selections build up: each click adds another bone to the lit-up set, and
  // clicking one that is already lit takes it back out again. A click that
  // misses the skeleton is left alone — panning the diagram shouldn't wipe out
  // everything marked so far.
  async function handleDiagramClick(event: React.MouseEvent<HTMLDivElement>) {
    const svg = event.currentTarget.querySelector('svg')
    if (!svg) return
    const target = selectionAt(event.target as Element, svg, selectionMode)
    if (!target) return

    const wasSelected = selected.includes(target)
    setSelected((current) =>
      wasSelected ? current.filter((element) => element !== target) : [...current, target],
    )

    // Deselecting doesn't clear the stored state yet, so only the additions are
    // written back for now.
    if (target.id && caseData && !wasSelected) {
      const stateToSave: SegmentState = 'complete' // Default state for demonstration; replace with actual logic as needed
      await updateSegmentState(caseId, target.id, stateToSave)
    }
  }

  function handleSearchOption(option: SearchOption) {
    const svg = diagramRef.current?.querySelector('svg')
    const match = [...(svg?.querySelectorAll<SVGElement>('[id]') ?? [])].find(
      (element) => element.id === option.id,
    )
    if (!svg || !match) return

    const selectedElement = selectionAt(match, svg, selectionMode)
    // Adds to the set for the same reason a click does, so picking bones by
    // name and by tapping them can be mixed freely.
    if (selectedElement) {
      setSelected((current) =>
        current.includes(selectedElement) ? current : [...current, selectedElement],
      )
    }
    setSearchTerm(option.label)
    setSheetOpen(false)
  }

  // Clearing on switch avoids leaving a bone lit up while the bar reads "zone",
  // which makes it look like the toggle didn't take.
  function toggleSelectionMode() {
    setSelectionMode((mode) => (mode === 'bone' ? 'zone' : 'bone'))
    setSelected([])
  }

  async function selectAllBones() {
    const svg = diagramRef.current?.querySelector('svg')
    if (!svg) return //If we couldn't find the SVG, stop the function

    const bones = boneOptions
      .map((bone) => svg.querySelector(`#${CSS.escape(bone.id)}`))
      .filter((bone): bone is Element => bone !== null)
    setSelected(bones)

    if (caseData) {
      await Promise.all(bones.map((bone) => updateSegmentState(caseId, bone.id, 'complete')))
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
      <p aria-live="polite">
        {selected.length === 1
          ? `Selected: ${selectionLabel(selected[0])}`
          : selected.length > 1
            ? `Selected: ${selected.length} ${selectionMode}s`
            : `Click a ${selectionMode} to select it.`}
      </p>
      <div
        ref={diagramRef}
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

      <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        <div
          ref={sheetRef}
          className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 p-2 shadow-[0_-8px_28px_rgba(15,23,42,0.12)] backdrop-blur-md"
        >
          <div
            className={[
              'overflow-hidden transition-all duration-300 ease-out',
              toolsOpen ? 'max-h-24 translate-y-0 opacity-100' : 'max-h-0 -translate-y-2 opacity-0',
            ].join(' ')}
          >
            <div className="mb-2 grid grid-cols-4 gap-2 border-b border-slate-200 px-1 pb-2">
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-2 py-3 text-xs font-medium text-slate-400"
                aria-label="Undo"
              >
                <Undo2 className="h-4 w-4" />
                Undo
              </button>
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-2 py-3 text-xs font-medium text-slate-400"
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
    </div>
  )
}

export default SkeletonPage
