import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import panzoom from '@panzoom/panzoom'
import type { NavigateFn } from './types'
import skeletonFrontSource from '../assets/skeleton_front.svg?raw'
import skeletonBackSource from '../assets/skeleton_back.svg?raw'
import skullFrontSource from '../assets/skull_front.svg?raw'
import skullLeftSource from '../assets/skull_left.svg?raw'
import skullRightSource from '../assets/skull_right.svg?raw'
import ribsSpineFrontSource from '../assets/ribs_spine_front.svg?raw'
import leftFootSource from '../assets/left_foot.svg?raw'
import rightFootSource from '../assets/right_foot.svg?raw'
import scapulaLeftSource from '../assets/scapula_left.svg?raw'
import scapulaRightSource from '../assets/scapula_right.svg?raw'
import leftHipSource from '../assets/left_pelvis.svg?raw'
import rightHipSource from '../assets/right_pelvis.svg?raw'
import type { CaseRecord, SegmentState } from '../db/types'
import { ArrowLeft, ArrowRight, Bone, CheckCheck, Eye, FlipHorizontal, List, Palette, Redo2, RotateCcw, ScanFace, Search, Share2, SlidersHorizontal, StickyNote, Undo2, X } from 'lucide-react'
import { getCase, setAllSegmentStates, updateCaseMetadata } from '../db/caseOperation'
import NotesPopup from '../components/NotesPopup'
import InfoPopup from '../components/InfoPopup'
import { VERTEBRA_DRAWINGS, prepareSkeletonFront, summariseZones, vertebraDrawingFor, zoneStandIns } from './skeletonArtwork'
import {
  coveringState,
  hierarchyOf,
  isUnrecorded,
  isUnrecordedId,
  markedElements,
  normalisedStates,
  topLevelIds,
  withMark,
  zonePosition,
  type Hierarchy,
} from './segmentMarks'



// Every drawing is inlined into the same page, so the .cls-1 / .st0 rules each
// Illustrator export ships with would restyle every other drawing on screen.
// Prefixing each drawing's classes keeps its look to itself. Which of the two
// names an export uses depends on its settings, so both are covered.
function scopeSvg(source: string, scope: string): string {
  return source
    .replace(/<\?xml[^?]*\?>/, '') // Strips the XML line of the svg file to prevent confusing HTML parser
    .replace(/\b(cls-\d+|st\d+)\b/g, `${scope}-$1`)
}

const SVG_NS = 'http://www.w3.org/2000/svg'

// Runs `edit` over a parsed copy of the markup and hands back the result.
function editSvg(markup: string, edit: (svg: Element) => void): string {
  const document = new DOMParser().parseFromString(markup, 'image/svg+xml')
  edit(document.documentElement)
  return new XMLSerializer().serializeToString(document.documentElement)
}

// Wraps each loose shape directly inside `container` in a group named after
// it, which is what the rest of the page already understands as "a bone with
// one zone", so selection and labelling fall out of the existing model. The
// shape takes the zone id `zoneId` gives it, or none at all when the bone's
// zones are recorded in a drawing of their own.
function wrapLooseShapes(container: Element, zoneId: (boneId: string) => string | null) {
  for (const child of [...container.children]) {
    if (child.tagName.toLowerCase() === 'g' || !child.id) continue

    const group = container.ownerDocument.createElementNS(SVG_NS, 'g')
    group.id = child.id
    const zone = zoneId(child.id)
    if (zone) child.id = zone
    else child.removeAttribute('id')
    child.replaceWith(group)
    group.append(child)
  }
}

// Gathers everything drawn on the canvas into one group carrying the id the
// same bone or region has in the drawing it is opened from, so marking it whole
// in one marks it whole in the other. The root's own id goes, both because the
// group takes over and because a click must never land on the root.
function gatherInto(svg: Element, id: string) {
  svg.removeAttribute('id')
  const group = svg.ownerDocument.createElementNS(SVG_NS, 'g')
  group.id = id
  for (const child of [...svg.children]) {
    if (child.tagName.toLowerCase() !== 'defs') group.append(child)
  }
  svg.append(group)
}

// Readied so marks made in the skull and scapula drawings land on it too (see
// skeletonArtwork).
const skeletonFront = prepareSkeletonFront(scopeSvg(skeletonFrontSource, 'front'))

const skeletonBack = scopeSvg(skeletonBackSource, 'back')
  .replaceAll('id="l_femur-2"', 'id="r_femur"')
  .replaceAll('data-name="l_femur"', 'data-name="r_femur"')
  .replaceAll('id="r_tibia-2"', 'id="l_tibia"')
  .replaceAll('data-name="r_tibia"', 'data-name="l_tibia"')
  .replace(/id="l_femur_([0-9]+)-2"/g, 'id="r_femur_$1"')
  .replace(/data-name="l_femur_([0-9]+)"/g, 'data-name="r_femur_$1"')
  .replace(/id="r_tibia_([0-9]+)-2"/g, 'id="l_tibia_$1"')
  .replace(/data-name="r_tibia_([0-9]+)"/g, 'data-name="l_tibia_$1"')

const skullFront = scopeSvg(skullFrontSource, 'skull-front')

const skullLeft = scopeSvg(skullLeftSource, 'skull-left')
const skullRight = scopeSvg(skullRightSource, 'skull-right')

// The ribs/spine export is the same artwork as the #spine_ribs group inside
// skeleton_front.svg, so the two have to agree on ids: a rib painted here is
// stored under that id and repainted in the full skeleton view from it.
// Illustrator writes underscores as _x5F_ here and numbers the cartilage one
// behind the skeleton file (cartilage1 there is cartilage-2 in skeleton_front),
// so both are normalised back before anything else looks at the markup.
const ribsSpineNormalised = scopeSvg(ribsSpineFrontSource, 'ribs')
  .replaceAll('_x5F_', '_')
  .replace(/id="cartilage(\d+)"/g, (_match, index) => `id="cartilage-${Number(index) + 1}"`)

// Every shape in this view is a bone in its own right — one rib, one vertebra,
// one cartilage pad — but the export leaves them as loose paths inside
// #l_ribs / #thoracic_vertebrae and friends, which would make bone mode select
// a whole rib cage at a time, so each is wrapped in a group named after it.
// Extra zones authored inside a rib in Illustrator land inside the same group
// and start working without any further change here.
function groupRibsAndVertebrae(markup: string): string {
  return editSvg(markup, (svg) => {
    const document = svg.ownerDocument

    // The root carries id="spine_ribs", which is also a paintable group in the
    // skeleton view — leaving it would let a click there paint the whole cage.
    svg.removeAttribute('id')

    // Rib 1 is exported as a group alongside its cage rather than inside it.
    // It already has the shape we want, it just belongs one level down.
    for (const side of ['l', 'r']) {
      const cage = document.getElementById(`${side}_ribs`)
      const firstRib = document.getElementById(`${side}_rib1`)
      if (cage && firstRib && firstRib.parentElement !== cage) cage.append(firstRib)
    }

    for (const containerId of ['l_ribs', 'r_ribs', 'thoracic_vertebrae', 'lumbar_vertebrae', 'cervical_vertebrae']) {
      const container = document.getElementById(containerId)
      if (!container) continue

      // A vertebra keeps its zones in the drawing of its type, so its outline
      // here takes no zone id of its own (which would shadow that drawing's
      // first zone) and is marked as something a zone-mode tap opens.
      wrapLooseShapes(container, (boneId) => (vertebraDrawingFor(boneId) ? null : `${boneId}_1`))
      for (const group of container.children) {
        if (vertebraDrawingFor(group.id)) group.setAttribute('data-zone-drawing', '')
      }
    }
  })
}

const ribsSpineFront = groupRibsAndVertebrae(ribsSpineNormalised)

// The foot as a whole is the l_foot / r_foot group the skeleton view marks, so
// marking the whole foot there shows on every bone here.
const leftFoot = editSvg(scopeSvg(leftFootSource, 'left-foot'), (svg) => gatherInto(svg, 'l_foot'))
const rightFoot = editSvg(scopeSvg(rightFootSource, 'right-foot'), (svg) => gatherInto(svg, 'r_foot'))

// The scapula and the hip bone (os coxa) are each a single bone drawn as loose zones.
const scapulaLeft = editSvg(scopeSvg(scapulaLeftSource, 'scapula-left'), (svg) => gatherInto(svg, 'l_scapula'))
const scapulaRight = editSvg(scopeSvg(scapulaRightSource, 'scapula-right'), (svg) => gatherInto(svg, 'r_scapula'))
const leftHip = editSvg(scopeSvg(leftHipSource, 'hip-left'), (svg) => gatherInto(svg, 'l_oscoxa'))
const rightHip = editSvg(scopeSvg(rightHipSource, 'hip-right'), (svg) => gatherInto(svg, 'r_oscoxa'))

// Hoisted so the prop keeps the same object identity across renders. React 19
// compares dangerouslySetInnerHTML by reference, so an inline literal would
// rebuild the whole SVG on every state change — detaching the very node we just
// selected, and later throwing away any pan/zoom transform sitting on it.
const skeletonFrontMarkup = { __html: skeletonFront }
const skeletonBackMarkup = { __html: skeletonBack }
const skullFrontMarkup = { __html: skullFront }
const skullLeftMarkup = { __html: skullLeft }
const skullRightMarkup = { __html: skullRight }
const ribsSpineFrontMarkup = { __html: ribsSpineFront }
const leftFootMarkup = { __html: leftFoot }
const rightFootMarkup = { __html: rightFoot }
const scapulaLeftMarkup = { __html: scapulaLeft }
const scapulaRightMarkup = { __html: scapulaRight }
const leftHipMarkup = { __html: leftHip }
const rightHipMarkup = { __html: rightHip }
const noMarkup = { __html: '' }

// Built on first use and kept for the same reason as the markup above.
const vertebraMarkups = new Map<string, { __html: string }>()

function vertebraMarkup(vertebraId: string | null): { __html: string } {
  const drawing = vertebraId ? vertebraDrawingFor(vertebraId) : undefined
  if (!vertebraId || !drawing) return noMarkup

  let markup = vertebraMarkups.get(vertebraId)
  if (!markup) {
    const relabelled = scopeSvg(drawing.source, 'vertebra').replaceAll(`${drawing.zonePrefix}_`, `${vertebraId}_`)
    markup = { __html: editSvg(relabelled, (svg) => gatherInto(svg, vertebraId)) }
    vertebraMarkups.set(vertebraId, markup)
  }
  return markup
}

// Where every id sits among the others, across all the drawings at once (see
// segmentMarks). Built on first use, as it reads every drawing.
let segmentHierarchy: Hierarchy | null = null

function hierarchy(): Hierarchy {
  segmentHierarchy ??= hierarchyOf([
    { markup: skeletonFront },
    { markup: skeletonBack },
    // The skull views draw nothing but the skull, and the spine view nothing
    // but the rib cage, so neither names the whole it is drawing.
    { markup: skullFront, within: 'skull' },
    { markup: skullLeft, within: 'skull' },
    { markup: skullRight, within: 'skull' },
    { markup: ribsSpineFront, within: 'spine_ribs' },
    { markup: leftFoot },
    { markup: rightFoot },
    { markup: scapulaLeft },
    { markup: scapulaRight },
    { markup: leftHip },
    { markup: rightHip },
    ...VERTEBRA_DRAWINGS.flatMap(({ count, prefix }) =>
      Array.from({ length: count }, (_, index) => ({ markup: vertebraMarkup(`${prefix}${index + 1}`).__html })),
    ),
  ])
  return segmentHierarchy
}

type ActiveView =
  | 'skeleton'
  | 'skeleton-back'
  | 'skull-front'
  | 'skull-left'
  | 'skull-right'
  | 'ribs-front'
  | 'foot-left'
  | 'foot-right'
  | 'scapula-left'
  | 'scapula-right'
  | 'hip-left'
  | 'hip-right'
  | 'vertebra'

// Which detail drawing a zoom lands on, which is also the layer that holds it.
// Held separately from the view because the animation runs while the view is
// still the one being zoomed in from.
type DetailTarget =
  | 'skull'
  | 'ribs'
  | 'l_foot'
  | 'r_foot'
  | 'l_scapula'
  | 'r_scapula'
  | 'l_oscoxa'
  | 'r_oscoxa'
  | 'vertebra'

// Paired bones whose sides are both open at once in the detail view.
type PairedTarget = 'l_foot' | 'r_foot' | 'l_scapula' | 'r_scapula' | 'l_oscoxa' | 'r_oscoxa'

// The view each zoom settles on.
const DETAIL_VIEW: Record<DetailTarget, ActiveView> = {
  skull: 'skull-front',
  ribs: 'ribs-front',
  l_foot: 'foot-left',
  r_foot: 'foot-right',
  l_scapula: 'scapula-left',
  r_scapula: 'scapula-right',
  l_oscoxa: 'hip-left',
  r_oscoxa: 'hip-right',
  vertebra: 'vertebra',
}

const DETAIL_LAYER: Record<DetailTarget, string> = {
  skull: 'skull-layer',
  ribs: 'ribs-layer',
  l_foot: 'left-foot-layer',
  r_foot: 'right-foot-layer',
  l_scapula: 'left-scapula-layer',
  r_scapula: 'right-scapula-layer',
  l_oscoxa: 'left-hip-layer',
  r_oscoxa: 'right-hip-layer',
  vertebra: 'vertebra-layer',
}

// Where each detail sits in the full skeleton, which is what a zoom into it
// flies towards. A vertebra is opened from the rib cage instead, and is
// whichever one was tapped.
const DETAIL_REGION: Record<Exclude<DetailTarget, 'vertebra'>, string> = {
  skull: '#skull',
  ribs: '#spine_ribs',
  l_foot: '#l_foot',
  r_foot: '#r_foot',
  l_scapula: '#l_scapula',
  r_scapula: '#r_scapula',
  l_oscoxa: '#l_oscoxa',
  r_oscoxa: '#r_oscoxa',
}

function detailTargetOf(view: ActiveView): DetailTarget | null {
  if (view === 'skeleton' || view === 'skeleton-back') return null
  if (view === 'skull-left' || view === 'skull-right') return 'skull'
  return (Object.keys(DETAIL_VIEW) as DetailTarget[]).find((target) => DETAIL_VIEW[target] === view) ?? null
}

// The markup a view shows, for reading its bones and zones and its proportions.
function rawSvgFor(view: ActiveView, vertebraId: string | null): string {
  switch (view) {
    case 'skull-front':
      return skullFront
    case 'skull-left':
      return skullLeft
    case 'skull-right':
      return skullRight
    case 'ribs-front':
      return ribsSpineFront
    case 'foot-left':
      return leftFoot
    case 'foot-right':
      return rightFoot
    case 'scapula-left':
      return scapulaLeft
    case 'scapula-right':
      return scapulaRight
    case 'hip-left':
      return leftHip
    case 'hip-right':
      return rightHip
    case 'vertebra':
      return vertebraMarkup(vertebraId).__html
    case 'skeleton-back':
      return skeletonBack
    default:
      return skeletonFront
  }
}

// What a zoomed-in view shows, for the title above it and for screen readers.
// A vertebra drawing stands in for a whole type, so its title names the one
// being recorded.
function viewTitle(view: ActiveView, vertebraId: string | null): string {
  switch (view) {
    case 'skull-front':
      return 'Skull — Anterior (Front) View'
    case 'skull-left':
      return 'Skull — Left Lateral View'
    case 'skull-right':
      return 'Skull — Right Lateral View'
    case 'ribs-front':
      return 'Spine & Ribs — Anterior (Front) View'
    case 'foot-left':
      return 'Left Foot — Dorsal View'
    case 'foot-right':
      return 'Right Foot — Dorsal View'
    case 'scapula-left':
      return 'Left Scapula — Anterior (Front) View'
    case 'scapula-right':
      return 'Right Scapula — Anterior (Front) View'
    case 'hip-left':
      return 'Left Hip Bone — Anterior (Front) View'
    case 'hip-right':
      return 'Right Hip Bone — Anterior (Front) View'
    case 'vertebra': {
      const drawing = vertebraId ? vertebraDrawingFor(vertebraId) : undefined
      return drawing && vertebraId
        ? `${drawing.type} Vertebra ${vertebraId.toUpperCase()} — Superior View`
        : 'Vertebra'
    }
    default:
      return ''
  }
}

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

// What each colour on the drawings means, for the colour key. The colours are
// the same tokens the drawings are painted with (see index.css).
const COLOUR_KEY = [
  { name: 'Present', colour: 'var(--paint-present)', meaning: 'Marked as present.' },
  { name: 'Absent', colour: 'var(--paint-absent)', meaning: 'Marked as absent.' },
  { name: 'Fragmentary', colour: 'var(--paint-fragmentary)', meaning: 'Marked as fragmentary.' },
  {
    name: 'Partly recorded',
    colour: 'var(--paint-partial)',
    meaning: "Only some of the bone's zones are marked. Open the bone to see which.",
  },
  {
    name: 'Opens a detailed drawing',
    colour: 'var(--bone-expandable)',
    meaning:
      'Tap to zoom in. The skull, spine & ribs and feet always open; the scapulae, hip bones and vertebrae open in zone mode.',
  },
  { name: 'Not marked yet', colour: 'var(--bone-unmarked)', meaning: 'Nothing recorded for this bone or zone.' },
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

// A bone is a <g> and its zones are the shapes drawn inside it. Groups are never
// painted and so can never be the click target themselves — the click always
// lands on a zone shape, which makes both modes fall out of the same event:
// keep the target for a zone, or step out to the first enclosing named group
// for a bone. Depth doesn't matter, so l_femur > path and
// l_hand > l_pollex > l_dist_pollex > path both resolve correctly. A shape with
// no id of its own can't be recorded, so in zone mode it stands for its bone.
function selectionAt(
  target: Element,
  svg: SVGSVGElement,
  mode: SelectionMode,
): Element | null {
  // Landing outside the drawing, or on the root, means the click missed the skeleton.
  if (!svg.contains(target) || target === svg) return null
  if (isUnrecorded(target)) return null
  return mode === 'zone' && target.id ? target : target.closest('g[id]')
}

// l_femur -> "Left femur", r_iv-2 -> "Right iv 2".
// This part is literally just to generate full bone name from abbreviation.
function boneLabel(id: string) {
  const words = id
    .replace(/^l_/, 'left_')
    .replace(/^r_/, 'right_')
    .replace(/rib(\d)/, 'rib $1')
    .replace('oscoxa', 'os coxa')
    .replaceAll(/[_-]/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Zones don't need names of their own, so they are named by position in their bone.
function recordLabel(id: string) {
  const zone = zonePosition(hierarchy(), id)
  return zone ? `${boneLabel(zone.bone)} — zone ${zone.index} of ${zone.count}` : boneLabel(id)
}

type SearchOption = {
  id: string
  label: string
}

function searchOptionsFromSvg(markup: string, mode: SelectionMode): SearchOption[] {
  const document = new DOMParser().parseFromString(markup, 'image/svg+xml')

  return [...document.querySelectorAll<SVGElement>('[id]')]
    .filter((element) => {
      if (isUnrecorded(element)) return false
      const isGroup = element.tagName.toLowerCase() === 'g'
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
  const target = detailTargetOf(view)
  if (target) return `.${DETAIL_LAYER[target]}`
  if (view === 'skeleton-back') return '.skeleton-back-layer'
  return '.skeleton-front-layer'
}

type ViewBox = { x: number; y: number; width: number; height: number }

function parseViewBox(value: string | null): ViewBox | null {
  const parts = value?.trim().split(/[\s,]+/).map(Number)
  if (!parts || parts.length !== 4 || parts.some(Number.isNaN)) return null
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
}

const formatViewBox = (box: ViewBox) => `${box.x} ${box.y} ${box.width} ${box.height}`

// Frames a box centred with `fill` of the result given over to it, forcing the
// proportions the drawing as a whole was laid out in, so the rib cage sits
// where the eye expects it.
function frameBox(box: ViewBox, fill: number, aspect: number): ViewBox {
  const centreX = box.x + box.width / 2
  const centreY = box.y + box.height / 2
  let width = box.width / fill
  let height = box.height / fill

  if (width / height < aspect) width = height * aspect
  else height = width / aspect

  return { x: centreX - width / 2, y: centreY - height / 2, width, height }
}

// getBBox() is in the element's own user units, which is the same space the
// viewBox is written in as long as nothing between it and the root is
// transformed — true of this drawing, and worth knowing if that ever changes.
function boundsOf(element: SVGGraphicsElement): ViewBox | null {
  try {
    const box = element.getBBox()
    if (!box.width || !box.height) return null
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  } catch {
    return null
  }
}

// The proportions a drawing is laid out in, read off its root viewBox.
function aspectOf(markup: string): number {
  const box = parseViewBox(markup.match(/viewBox="([^"]+)"/)?.[1] ?? null)
  return box ? box.width / box.height : 1
}

type Rect = { left: number; top: number; width: number; height: number }

// Where a drawing of the given proportions lands inside a layer: the layer's
// padded box, shrunk to the drawing's aspect ratio and centred in it, which is
// the fit the CSS gives every diagram SVG. Worked out rather than measured, so
// it holds for a drawing that isn't on screen yet.
function fittedRect(layer: HTMLElement, aspect: number): Rect {
  const box = layer.getBoundingClientRect()
  const style = getComputedStyle(layer)
  const left = box.left + parseFloat(style.paddingLeft)
  const top = box.top + parseFloat(style.paddingTop)
  const width = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  const height = box.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
  const fitWidth = Math.min(width, height * aspect)
  const fitHeight = fitWidth / aspect

  return {
    left: left + (width - fitWidth) / 2,
    top: top + (height - fitHeight) / 2,
    width: fitWidth,
    height: fitHeight,
  }
}

// The zoom that carries a drawing onto one region of it, as the custom
// properties the zoom CSS reads: the region's centre becomes the transform
// origin, the shift carries that centre onto the middle of where the next
// drawing lands, and the scale makes the region as big as that drawing. It is
// all measured on screen, so it holds at any viewport size and for any region,
// wherever the artwork happens to put it.
function zoomStyle(svg: SVGSVGElement, region: Element, landing: Rect): React.CSSProperties {
  const box = svg.getBoundingClientRect()
  const area = region.getBoundingClientRect()
  if (!box.width || !box.height || !area.width || !area.height) return {}

  const centreX = area.left + area.width / 2
  const centreY = area.top + area.height / 2
  const percent = (fraction: number) => `${fraction * 100}%`

  return {
    '--zoom-origin-x': percent((centreX - box.left) / box.width),
    '--zoom-origin-y': percent((centreY - box.top) / box.height),
    '--zoom-shift-x': percent((landing.left + landing.width / 2 - centreX) / box.width),
    '--zoom-shift-y': percent((landing.top + landing.height / 2 - centreY) / box.height),
    '--zoom-scale': String(Math.min(landing.width / area.width, landing.height / area.height)),
  } as React.CSSProperties
}

// The bar that slides down under the header while a detail drawing is open,
// holding the way back out and anything that moves between its views. While
// it is tucked away it is inert, so none of its buttons can be tabbed to.
function DetailSubBar({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={['skull-sub-bar-wrapper', visible ? 'is-visible' : ''].filter(Boolean).join(' ')}
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="skull-sub-bar-content flex items-center justify-between gap-2 border-b border-sky-100 bg-sky-50/95 px-3 py-1.5 backdrop-blur-md shadow-xs">
        {children}
      </div>
    </div>
  )
}

function SubBarBackButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700 shadow-xs hover:bg-sky-100 hover:text-sky-800 transition-all cursor-pointer"
      title={title}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      <span>{children}</span>
    </button>
  )
}

type ViewToggleOption = {
  label: React.ReactNode
  title: string
  icon?: React.ReactNode
  active: boolean
  onSelect: () => void
}

// Switches between the views of one detail drawing, such as the skull's
// sides or the left and right foot.
function ViewToggle({ options }: { options: ViewToggleOption[] }) {
  return (
    <div className="flex shrink-0 items-center rounded-xl border border-sky-200/80 bg-white p-0.5 shadow-xs">
      {options.map((option) => (
        <button
          key={option.title}
          type="button"
          onClick={option.onSelect}
          aria-pressed={option.active}
          className={[
            'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
            option.active
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50',
          ].join(' ')}
          title={option.title}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}

function historyStoreKey(caseId: string): string {
  return `osteomap:${caseId}:history`
}

function readHistory(caseId: string) {
  try {
    const raw = localStorage.getItem(historyStoreKey(caseId))
    if (!raw) return { undoStack: [] as Record<string, SegmentState>[], redoStack: [] as Record<string, SegmentState>[] }
    const parsed = JSON.parse(raw) as { undoStack?: Record<string, SegmentState>[]; redoStack?: Record<string, SegmentState>[] }
    return {
      undoStack: Array.isArray(parsed.undoStack) ? parsed.undoStack : [],
      redoStack: Array.isArray(parsed.redoStack) ? parsed.redoStack : [],
    }
  } catch {
    return { undoStack: [] as Record<string, SegmentState>[], redoStack: [] as Record<string, SegmentState>[] }
  }
}

function SkeletonPage({ caseId, onNavigate }: { caseId: string; onNavigate: NavigateFn }) {
  const [activeView, setActiveView] = useState<ActiveView>('skeleton')
  const [detailTarget, setDetailTarget] = useState<DetailTarget>('skull')
  // The vertebra whose drawing is open or opening, by id. The one drawing for
  // its type is relabelled to it, so this decides whose zones are on screen.
  const [openVertebraId, setOpenVertebraId] = useState<string | null>(null)
  // Whether the detail in play was opened from the back of the skeleton, which
  // is then the view a zoom flies through and returns to.
  const [zoomedFromBack, setZoomedFromBack] = useState(false)
  // Where the zoom in flight is headed, measured as it starts (see zoomStyle).
  const [zoomFrame, setZoomFrame] = useState<React.CSSProperties>({})
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle')
  // The record as it stood before each change still undoable, and after each one undone.
  const [undoStack, setUndoStack] = useState<Record<string, SegmentState>[]>(() => readHistory(caseId).undoStack)
  const [redoStack, setRedoStack] = useState<Record<string, SegmentState>[]>(() => readHistory(caseId).redoStack)
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('bone')
  const [activePaint, setActivePaint] = useState<PaintState>('present')
  const [notesOpen, setNotesOpen] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [caseData, setCaseData] = useState<CaseRecord | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const diagramRef = useRef<HTMLDivElement | null>(null)
  const searchSwipeStart = useRef<{ x: number; y: number } | null>(null)
  const searchSwipeTriggered = useRef(false)
  const isDragging = useRef(false)
  const panzoomRef = useRef<ReturnType<typeof panzoom> | null>(null)
  const ribsFramedRef = useRef(false)


  const currentRawSvg = useMemo(() => rawSvgFor(activeView, openVertebraId), [activeView, openVertebraId])

  const isRibsView = activeView === 'ribs-front'
  const isDetailView = detailTargetOf(activeView) !== null
  const isZooming =
    transitionPhase === 'zooming-in' ||
    transitionPhase === 'fading-in' ||
    transitionPhase === 'fading-out' ||
    transitionPhase === 'zooming-out'
  const isFlipping = transitionPhase === 'flipping-to-back' || transitionPhase === 'flipping-to-front'
  // A vertebra is zoomed into from the rib cage; everything else from the
  // full skeleton, front or back, whichever it was opened from.
  const zoomSource =
    detailTarget === 'vertebra' ? 'ribs' : zoomedFromBack ? 'skeleton-back' : 'skeleton'

  // Which view's sub-bar is on screen. The one being left slides out as a zoom
  // starts and the one being zoomed into slides in as its drawing fades in, or
  // straight away on the way back out.
  const subBarView: ActiveView | null =
    transitionPhase === 'zooming-in' || transitionPhase === 'fading-out'
      ? null
      : transitionPhase === 'fading-in'
        ? DETAIL_VIEW[detailTarget]
        : transitionPhase === 'zooming-out'
          ? (zoomSource === 'ribs' ? 'ribs-front' : zoomSource)
          : activeView
  const subBarTarget = subBarView ? detailTargetOf(subBarView) : null
  const isSkeletonBarVisible = subBarView === 'skeleton' || subBarView === 'skeleton-back'
  const isSkullBarVisible = subBarTarget === 'skull'
  const isRibsBarVisible = subBarTarget === 'ribs'
  const isFootBarVisible = subBarTarget === 'l_foot' || subBarTarget === 'r_foot'
  const isScapulaBarVisible = subBarTarget === 'l_scapula' || subBarTarget === 'r_scapula'
  const isHipBarVisible = subBarTarget === 'l_oscoxa' || subBarTarget === 'r_oscoxa'
  const isVertebraBarVisible = subBarTarget === 'vertebra'

  const segmentStates = caseData?.segmentStates
  // What the record holds, counted once however many drawings show each mark.
  const recordedIds = Object.keys(segmentStates ?? {}).filter((id) => !isUnrecordedId(id))

  // The title over a zoomed-in drawing names what it shows. It switches to the
  // drawing being zoomed into as that fades in, and keeps its text while it
  // fades out on the way back.
  const isTitleVisible = (transitionPhase === 'idle' && isDetailView) || transitionPhase === 'fading-in'
  const title = viewTitle(transitionPhase === 'fading-in' ? DETAIL_VIEW[detailTarget] : activeView, openVertebraId)

  const boneOptions = useMemo(() => searchOptionsFromSvg(currentRawSvg, 'bone'), [currentRawSvg])
  const zoneOptions = useMemo(() => searchOptionsFromSvg(currentRawSvg, 'zone'), [currentRawSvg])

  const searchOptions = selectionMode === 'bone' ? boneOptions : zoneOptions
  const searchMatches = searchOptions
    .filter((bone) => {
      const query = searchTerm.toLowerCase()
      return bone.label.toLowerCase().includes(query) || bone.id.toLowerCase().includes(query)
    })
    .slice(0, 50)

  // Load the case record on mount. Changes made to another case can't be undone here.
  useEffect(() => {
    let active = true

    getCase(caseId).then((data) => {
      if (!active) return
      setCaseData(data ? { ...data, segmentStates: normalisedStates(hierarchy(), data.segmentStates ?? {}) } : null)
      const savedHistory = readHistory(caseId)
      setUndoStack(savedHistory.undoStack)
      setRedoStack(savedHistory.redoStack)
    })

    return () => {
      active = false
    }
  }, [caseId])

  useEffect(() => {
    if (!caseId) return
    localStorage.setItem(historyStoreKey(caseId), JSON.stringify({ undoStack, redoStack }))
  }, [caseId, undoStack, redoStack])

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

  // Track whether the pointer movement is a drag/pan rather than a stationary click,
  // preventing accidental bone selection when panning the canvas.
  useEffect(() => {
    const container = diagramRef.current
    if (!container) return

    let startX = 0
    let startY = 0

    const onPointerDown = (e: PointerEvent) => {
      startX = e.clientX
      startY = e.clientY
      isDragging.current = false
    }

    const onPointerMove = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 5) {
        isDragging.current = true
      }
    }

    const onPointerUp = () => {
      setTimeout(() => {
        isDragging.current = false
      }, 50)
    }

    container.addEventListener('pointerdown', onPointerDown, { capture: true })
    window.addEventListener('pointermove', onPointerMove, { capture: true })
    window.addEventListener('pointerup', onPointerUp, { capture: true })

    return () => {
      container.removeEventListener('pointerdown', onPointerDown, { capture: true })
      window.removeEventListener('pointermove', onPointerMove, { capture: true })
      window.removeEventListener('pointerup', onPointerUp, { capture: true })
    }
  }, [])

  useEffect(() => {
    if (transitionPhase !== 'idle') return

    const activeLayer = getActiveLayerClass(activeView)
    const svg = diagramRef.current?.querySelector(`${activeLayer} svg`) as SVGSVGElement | null
    if (!svg) return

    const zoom = panzoom(svg, {
      maxScale: 6,
      minScale: 0.5,
      step: 0.25,
      canvas: true,
      cursor: 'grab',
      handleStartEvent: (event) => {
        event.preventDefault()
      },
    })

    let refocusTimer: ReturnType<typeof setTimeout> | null = null
    const refocus = () => {
      // Force Chromium/WebKit to invalidate its cached GPU raster texture
      // and re-rasterize the vector paths sharply at the new zoom scale
      svg.style.display = 'none'
      void svg.getBoundingClientRect()
      svg.style.display = ''
    }

    const scheduleRefocus = () => {
      if (refocusTimer) clearTimeout(refocusTimer)
      refocusTimer = setTimeout(refocus, 80)
    }

    const handleWheel = (event: WheelEvent) => {
      zoom.zoomWithWheel(event)
      scheduleRefocus()
    }

    svg.addEventListener('panzoomzoom', scheduleRefocus)
    svg.addEventListener('panzoomend', refocus)

    const container = diagramRef.current
    container?.addEventListener('wheel', handleWheel, { passive: false })

    panzoomRef.current = zoom

    return () => {
      if (refocusTimer) clearTimeout(refocusTimer)
      svg.removeEventListener('panzoomzoom', scheduleRefocus)
      svg.removeEventListener('panzoomend', refocus)
      panzoomRef.current = null
      container?.removeEventListener('wheel', handleWheel)
      zoom.destroy()
    }
  }, [activeView, transitionPhase])

  // The ribs drawing keeps the full skeleton's coordinate space, so its own
  // artwork sits in a corner of a mostly empty viewBox and is reframed onto the
  // artwork once. That happens as soon as the drawing is the one in play rather
  // than once it is the active view, so it lands under cover of the zoom
  // instead of snapping into place once the drawing is already visible.
  useEffect(() => {
    if ((!isRibsView && detailTarget !== 'ribs') || ribsFramedRef.current) return

    const svg = diagramRef.current?.querySelector('.ribs-layer svg') as SVGSVGElement | null
    if (!svg) return

    const declared = parseViewBox(svg.getAttribute('viewBox'))
    const content = boundsOf(svg)
    if (!declared || !content) return

    svg.setAttribute('viewBox', formatViewBox(frameBox(content, 0.94, declared.width / declared.height)))
    ribsFramedRef.current = true
  }, [isRibsView, detailTarget])

  // Paints every drawing on the page from the record, so a mark shows the same
  // in every drawing of what it covers, however it was made. The CSS cascades
  // the colour from a group down onto its shapes, so it only ever needs to go on
  // the marked element itself. It runs before the browser paints, and again
  // whenever a drawing is swapped for another (a skull side, a vertebra), so
  // nothing shows unmarked for a frame.
  //
  // Where a bone is drawn only whole (a foot, scapula or hip bone on the full
  // skeleton, a vertebra in the spine view), marks on its zones made in its own
  // drawing would otherwise leave no trace. Those drawings show what the zones
  // add up to instead (see summariseZones), unless the bone is marked itself.
  useLayoutEffect(() => {
    const diagram = diagramRef.current
    if (!diagram || !segmentStates) return

    const marked = [...diagram.querySelectorAll('.diagram-layer svg')].flatMap((svg) =>
      markedElements(hierarchy(), svg, segmentStates),
    )
    for (const { element, state } of marked) {
      const paint = PAINT_STATE_BY_SEGMENT[state]
      if (!paint) continue
      element.classList.add('is-selected')
      element.setAttribute('data-paint', paint)
    }

    const summarised: Element[] = []
    for (const [boneId, summary] of summariseZones(segmentStates)) {
      for (const element of zoneStandIns(diagram, boneId)) {
        if (marked.some((entry) => entry.element.contains(element))) continue
        element.setAttribute('data-zones', summary)
        summarised.push(element)
      }
    }

    return () => {
      for (const { element } of marked) {
        element.classList.remove('is-selected')
        element.removeAttribute('data-paint')
      }
      summarised.forEach((element) => element.removeAttribute('data-zones'))
    }
  }, [segmentStates, activeView, openVertebraId])

  // Measures the zoom between a detail drawing, as `view` shows it, and the
  // drawing it is opened from: the rib cage for a vertebra, and the front or
  // back of the full skeleton for everything else.
  function measureZoom(
    target: DetailTarget,
    view: ActiveView,
    vertebraId: string | null,
    fromBack: boolean,
  ): React.CSSProperties {
    const diagram = diagramRef.current
    const svg = diagram?.querySelector<SVGSVGElement>(
      target === 'vertebra' ? '.ribs-layer svg' : fromBack ? '.skeleton-back-layer svg' : '.skeleton-front-layer svg',
    )
    const landing = diagram?.querySelector<HTMLElement>(`.${DETAIL_LAYER[target]}`)
    const regionSelector =
      target === 'vertebra' ? vertebraId && `#${CSS.escape(vertebraId)}` : DETAIL_REGION[target]
    const region = regionSelector ? svg?.querySelector(regionSelector) : null
    if (!svg || !landing || !region) return {}

    // Clear any inline panzoom transform on both drawings first, so the region
    // is measured, and the zoom starts and lands, from rest rather than from
    // wherever either was last panned to.
    svg.style.transform = ''
    landing.querySelector('svg')?.style.removeProperty('transform')
    return zoomStyle(svg, region, fittedRect(landing, aspectOf(rawSvgFor(view, vertebraId))))
  }

  // Every detail drawing opens in the same three steps; only the drawing the
  // zoom flies through, the region it flies towards and the drawing that fades
  // in over it differ.
  function zoomToDetail(target: DetailTarget, vertebraId: string | null = null) {
    if (transitionPhase !== 'idle') return

    // A vertebra opens from the rib cage, which keeps the side it was opened from.
    const fromBack = target === 'vertebra' ? zoomedFromBack : activeView === 'skeleton-back'
    setZoomedFromBack(fromBack)
    setZoomFrame(measureZoom(target, DETAIL_VIEW[target], vertebraId, fromBack))
    setDetailTarget(target)

    // Step 1: Smoothly zoom into the region while keeping the outer drawing 100% visible
    setTransitionPhase('zooming-in')

    // Step 2: At 550ms (as zoom gently settles), begin seamless cross-fade to the detail SVG
    setTimeout(() => {
      setTransitionPhase('fading-in')

      // Step 3: Allow 450ms for the detail SVG to dissolve into view over the zoomed region
      setTimeout(() => {
        setActiveView(DETAIL_VIEW[target])
        setTransitionPhase('idle')
      }, 450)
    }, 550)
  }

  // The vertebra drawing is relabelled before the zoom sets off, so the zones
  // that fade in are already this vertebra's own.
  function openVertebra(vertebraId: string) {
    if (transitionPhase !== 'idle') return
    setOpenVertebraId(vertebraId)
    zoomToDetail('vertebra', vertebraId)
  }

  // Back out to the drawing the current detail was opened from.
  function zoomBackOut() {
    if (transitionPhase !== 'idle') return

    const toRibs = detailTarget === 'vertebra'
    setZoomFrame(measureZoom(detailTarget, activeView, openVertebraId, zoomedFromBack))

    // Immediately hide the detail layer and start zooming out the outer drawing and retracting toolbar simultaneously
    setTransitionPhase('zooming-out')

    // Settle back on the outer view once animations complete (500ms)
    setTimeout(() => {
      setActiveView(toRibs ? 'ribs-front' : zoomedFromBack ? 'skeleton-back' : 'skeleton')
      if (toRibs) setDetailTarget('ribs')
      setTransitionPhase('idle')
    }, 500)
  }

  // Both sides of a paired bone are always mounted, so moving between them
  // inside the detail view is only a matter of which one shows.
  function showSide(target: PairedTarget) {
    if (transitionPhase !== 'idle') return
    setDetailTarget(target)
    setActiveView(DETAIL_VIEW[target])
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

    // If currently in a detail view or the back view, return to anterior skeleton view
    if (activeView !== 'skeleton') {
      setActiveView('skeleton')
      setTransitionPhase('idle')
    }

    // Reset pan and zoom to default scale (1.0) and center position (0, 0)
    if (panzoomRef.current) {
      panzoomRef.current.reset({ animate: true })
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
}


  // A click that misses the skeleton is left alone — panning the diagram
  // shouldn't wipe out everything marked so far.
  function handleDiagramClick(event: React.MouseEvent<HTMLDivElement>) {
    if (transitionPhase !== 'idle') return
    if (isDragging.current) return

    const activeLayer = getActiveLayerClass(activeView)
    const svg = event.currentTarget.querySelector(`${activeLayer} svg`) as SVGSVGElement | null
    if (!svg) return

    const rawTarget = event.target as Element

    // Clicking the skull, the rib cage or a foot in either skeleton view
    // triggers the smooth zoom into that detail drawing rather than painting it.
    // The back opens the same drawings as the front; their titles say which
    // side each one is drawn from.
    if (activeView === 'skeleton' || activeView === 'skeleton-back') {
      if (rawTarget.closest('#skull')) {
        zoomToDetail('skull')
        return
      }
      if (rawTarget.closest('#spine_ribs')) {
        zoomToDetail('ribs')
        return
      }
      const foot = rawTarget.closest('#l_foot, #r_foot')
      if (foot) {
        zoomToDetail(foot.id === 'l_foot' ? 'l_foot' : 'r_foot')
        return
      }
      // A scapula or hip bone is a single bone, so bone mode marks it from here
      // like any other. Only its zones need the drawing of its own.
      const single =
        selectionMode === 'zone' ? rawTarget.closest('#l_scapula, #r_scapula, #l_oscoxa, #r_oscoxa') : null
      if (single) {
        zoomToDetail(single.id as PairedTarget)
        return
      }
    }

    // The same rule one level down: in zone mode a vertebra opens the drawing
    // of its type, relabelled to it, so its own zones can be reached. In bone
    // mode it is marked where it is, like the ribs around it.
    if (isRibsView && selectionMode === 'zone') {
      const vertebra = rawTarget.closest('[data-zone-drawing]')
      if (vertebra) {
        openVertebra(vertebra.id)
        return
      }
    }

    const target = selectionAt(rawTarget, svg, selectionMode)
    if (target) markSegment(target.id)
  }

  // Saves the record as it now stands. It is also what every drawing is painted from.
  async function saveStates(next: Record<string, SegmentState>) {
    setCaseData((prev) => (prev ? { ...prev, segmentStates: next } : prev))
    try {
      await setAllSegmentStates(caseId, next)
    } catch (err) {
      console.error('Failed to save segment states:', err)
    }
  }

  function applyChange(next: Record<string, SegmentState>) {
    setUndoStack((stack) => [...stack, segmentStates ?? {}])
    setRedoStack([])
    void saveStates(next)
  }

  // Marks build up: each tap paints another segment in the active colour, and
  // tapping one that already shows that colour, as itself or as part of
  // something marked whole, wipes it, so the same button both paints and
  // erases. Tapping it in a different colour repaints instead.
  function markSegment(id: string) {
    const states = segmentStates ?? {}
    const state = SEGMENT_STATE_BY_PAINT[activePaint]
    const erasing = coveringState(hierarchy(), states, id, state) === state
    applyChange(withMark(hierarchy(), states, id, erasing ? null : state))
  }

  function undo() {
    if (undoStack.length === 0) return
    setUndoStack((stack) => stack.slice(0, -1))
    setRedoStack((stack) => [...stack, segmentStates ?? {}])
    void saveStates(undoStack[undoStack.length - 1])
  }

  function redo() {
    if (redoStack.length === 0) return
    setRedoStack((stack) => stack.slice(0, -1))
    setUndoStack((stack) => [...stack, segmentStates ?? {}])
    void saveStates(redoStack[redoStack.length - 1])
  }

  // Picking a bone by name paints it in the active colour, so picking by name
  // and by tapping can be mixed freely. Unlike a tap it never erases.
  function handleSearchOption(option: SearchOption) {
    const activeLayer = getActiveLayerClass(activeView)
    const svg = diagramRef.current?.querySelector(`${activeLayer} svg`) as SVGSVGElement | null
    const match = [...(svg?.querySelectorAll<SVGElement>('[id]') ?? [])].find(
      (element) => element.id === option.id,
    )
    const target = svg && match ? selectionAt(match, svg, selectionMode) : null
    if (target) {
      applyChange(withMark(hierarchy(), segmentStates ?? {}, target.id, SEGMENT_STATE_BY_PAINT[activePaint]))
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

  // Marks everything in the drawing on screen: whatever sits at the top of it,
  // and so everything inside that too, in every drawing of it. Marks made
  // before inside any of it go, as the prompt warns.
  function selectAllBones() {
    const label = paintLabel(activePaint)
    const confirmed = window.confirm(
      `Are you sure you want to mark ALL bones in this view as "${label}"? This will overwrite current bone states.`
    )
    if (!confirmed) return

    const activeLayer = getActiveLayerClass(activeView)
    const svg = diagramRef.current?.querySelector(`${activeLayer} svg`) as SVGSVGElement | null
    if (!svg) return

    const state = SEGMENT_STATE_BY_PAINT[activePaint]
    applyChange(
      topLevelIds(svg).reduce((states, id) => withMark(hierarchy(), states, id, state), segmentStates ?? {}),
    )
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

  // What carries a drawing through a zoom when it is the one being zoomed in
  // from: it flies towards the region, holds there while the detail fades in
  // over it, and flies back out on the way home.
  const zoomSourceClasses = [
    transitionPhase === 'zooming-in' ? 'layer-zooming-in' : '',
    transitionPhase === 'fading-in' ? 'layer-zoomed-fade-out' : '',
    transitionPhase === 'fading-out' ? 'layer-zoomed-hold' : '',
    transitionPhase === 'zooming-out' ? 'layer-zooming-out' : '',
  ]

  // Every detail drawing sits in the stack at all times, so each one has to stay
  // out of the way unless it is the one being zoomed into or already open. The
  // rib cage is also what a zoom into a vertebra flies through, and while a
  // vertebra is in play it takes the part the skeleton plays for the others.
  function detailLayerClass(target: DetailTarget): string {
    if (target === 'ribs' && zoomSource === 'ribs') {
      return [
        'diagram-layer detail-layer',
        DETAIL_LAYER.ribs,
        ...zoomSourceClasses,
        activeView !== 'ribs-front' && !isZooming ? 'layer-hidden' : '',
      ]
        .filter(Boolean)
        .join(' ')
    }

    return [
      'diagram-layer detail-layer',
      DETAIL_LAYER[target],
      detailTarget !== target ? 'layer-hidden' : '',
      !isDetailView && transitionPhase === 'idle' ? 'layer-hidden' : '',
      transitionPhase === 'zooming-in' ? 'layer-hidden' : '',
      transitionPhase === 'fading-in' ? 'layer-fade-in' : '',
      transitionPhase === 'fading-out' ? 'layer-fade-out' : '',
      transitionPhase === 'zooming-out' ? 'layer-hidden' : '',
      isFlipping ? 'layer-hidden' : '',
    ]
      .filter(Boolean)
      .join(' ')
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
          <span className="max-w-full truncate text-xs font-bold uppercase tracking-wider text-sky-700">
            {caseData?.caseName ?? 'Skeleton'}
          </span>
          <span aria-live="polite" className="max-w-full truncate text-[11px] font-medium text-slate-500">
            {recordedIds.length === 1
              ? `${recordLabel(recordedIds[0])} — ${paintLabel(PAINT_STATE_BY_SEGMENT[segmentStates![recordedIds[0]]] ?? 'present')}`
              : recordedIds.length > 1
                ? `${recordedIds.length} segments marked`
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
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            type="button"
            onClick={() => setKeyOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 transition-colors cursor-pointer"
            title="Colour key"
          >
            <Palette className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Key</span>
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
        <DetailSubBar visible={isSkullBarVisible}>
          <SubBarBackButton onClick={zoomBackOut} title="Return to full skeleton view">
            <span className="hidden sm:inline">Full </span>Skeleton
          </SubBarBackButton>

          {/* View Toggle: Front, Left or Right */}
          <ViewToggle
            options={[
              {
                label: <>Front<span className="hidden sm:inline"> View</span></>,
                title: 'View Anterior (Front) Skull',
                icon: <ScanFace className="h-3.5 w-3.5" />,
                active: activeView === 'skull-front',
                onSelect: () => setActiveView('skull-front'),
              },
              {
                label: <>Left<span className="hidden sm:inline"> View</span></>,
                title: 'View Lateral (Left) Skull',
                icon: <Eye className="h-3.5 w-3.5" />,
                active: activeView === 'skull-left',
                onSelect: () => setActiveView('skull-left'),
              },
              {
                label: <>Right<span className="hidden sm:inline"> View</span></>,
                title: 'View Lateral (Right) Skull',
                icon: <Eye className="h-3.5 w-3.5" />,
                active: activeView === 'skull-right',
                onSelect: () => setActiveView('skull-right'),
              },
            ]}
          />
        </DetailSubBar>

        {/* Spine & Ribs View Mode Sub-Bar attached directly to bottom of header */}
        <DetailSubBar visible={isRibsBarVisible}>
          <SubBarBackButton onClick={zoomBackOut} title="Return to full skeleton view">
            <span className="hidden sm:inline">Full </span>Skeleton
          </SubBarBackButton>

          <span className="truncate text-[11px] font-semibold text-sky-800">
            {selectionMode === 'zone'
              ? 'Tap a vertebra to open its zones'
              : 'Switch to zone mode to open a vertebra'}
          </span>
        </DetailSubBar>

        {/* Foot View Mode Sub-Bar attached directly to bottom of header */}
        <DetailSubBar visible={isFootBarVisible}>
          <SubBarBackButton onClick={zoomBackOut} title="Return to full skeleton view">
            <span className="hidden sm:inline">Full </span>Skeleton
          </SubBarBackButton>

          <ViewToggle
            options={[
              {
                label: <>Left<span className="hidden sm:inline"> Foot</span></>,
                title: 'View Left Foot',
                active: activeView === 'foot-left',
                onSelect: () => showSide('l_foot'),
              },
              {
                label: <>Right<span className="hidden sm:inline"> Foot</span></>,
                title: 'View Right Foot',
                active: activeView === 'foot-right',
                onSelect: () => showSide('r_foot'),
              },
            ]}
          />
        </DetailSubBar>

        {/* Scapula View Mode Sub-Bar attached directly to bottom of header */}
        <DetailSubBar visible={isScapulaBarVisible}>
          <SubBarBackButton onClick={zoomBackOut} title="Return to full skeleton view">
            <span className="hidden sm:inline">Full </span>Skeleton
          </SubBarBackButton>

          <ViewToggle
            options={[
              {
                label: <>Left<span className="hidden sm:inline"> Scapula</span></>,
                title: 'View Left Scapula',
                active: activeView === 'scapula-left',
                onSelect: () => showSide('l_scapula'),
              },
              {
                label: <>Right<span className="hidden sm:inline"> Scapula</span></>,
                title: 'View Right Scapula',
                active: activeView === 'scapula-right',
                onSelect: () => showSide('r_scapula'),
              },
            ]}
          />
        </DetailSubBar>

        {/* Hip Bone View Mode Sub-Bar attached directly to bottom of header */}
        <DetailSubBar visible={isHipBarVisible}>
          <SubBarBackButton onClick={zoomBackOut} title="Return to full skeleton view">
            <span className="hidden sm:inline">Full </span>Skeleton
          </SubBarBackButton>

          <ViewToggle
            options={[
              {
                label: <>Left<span className="hidden sm:inline"> Hip</span></>,
                title: 'View Left Hip Bone',
                active: activeView === 'hip-left',
                onSelect: () => showSide('l_oscoxa'),
              },
              {
                label: <>Right<span className="hidden sm:inline"> Hip</span></>,
                title: 'View Right Hip Bone',
                active: activeView === 'hip-right',
                onSelect: () => showSide('r_oscoxa'),
              },
            ]}
          />
        </DetailSubBar>

        {/* Vertebra View Mode Sub-Bar attached directly to bottom of header */}
        <DetailSubBar visible={isVertebraBarVisible}>
          <SubBarBackButton onClick={zoomBackOut} title="Return to the spine and ribs view">
            Spine<span className="hidden sm:inline"> &amp; Ribs</span>
          </SubBarBackButton>
        </DetailSubBar>

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
              onClick={() => zoomToDetail('skull')}
              disabled={activeView !== 'skeleton' && activeView !== 'skeleton-back'}
              className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700 shadow-xs hover:bg-sky-50 hover:text-sky-800 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
              title="Zoom to detailed skull view"
              tabIndex={isSkeletonBarVisible ? 0 : -1}
            >
              <ScanFace className="h-3.5 w-3.5 text-sky-600" />
              <span>Skull<span className="hidden sm:inline"> View</span></span>
            </button>

            <button
              type="button"
              onClick={() => zoomToDetail('ribs')}
              disabled={activeView !== 'skeleton' && activeView !== 'skeleton-back'}
              className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700 shadow-xs hover:bg-sky-50 hover:text-sky-800 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
              title="Zoom to detailed spine and ribs view"
              tabIndex={isSkeletonBarVisible ? 0 : -1}
            >
              <Bone className="h-3.5 w-3.5 text-sky-600" />
              <span>Spine<span className="hidden sm:inline"> &amp; Ribs</span></span>
            </button>

            {/* View Toggle: Front vs Back */}
            <div className="flex items-center rounded-xl border border-sky-200/80 bg-white p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => flipSkeletonView('skeleton')}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
                  // Zooming back out of a detail always lands on the front, so
                  // anything other than the back reads as the front here.
                  activeView !== 'skeleton-back'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50',
                ].join(' ')}
                title="View Anterior (Front) Skeleton"
                tabIndex={isSkeletonBarVisible ? 0 : -1}
              >
                <ScanFace className="h-3.5 w-3.5" />
                <span>Front<span className="hidden sm:inline"> View</span></span>
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
                <span>Back<span className="hidden sm:inline"> View</span></span>
              </button>
            </div>

            <span className="hidden sm:inline-flex items-center rounded-lg bg-sky-100/80 px-2 py-1 text-[11px] font-semibold text-sky-800">
              {activeView === 'skeleton-back' ? 'Skeleton — Posterior' : 'Skeleton — Anterior'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Skeleton / Detail Diagram */}
      <div
        ref={diagramRef}
        className={['skeleton-diagram', selectionMode === 'zone' ? 'zone-mode' : ''].filter(Boolean).join(' ')}
        role="img"
        aria-label={
          activeView === 'skeleton'
            ? 'Anterior view of the human skeleton'
            : activeView === 'skeleton-back'
              ? 'Posterior view of the human skeleton'
              : viewTitle(activeView, openVertebraId)
        }
        onClick={handleDiagramClick}
      >
        {/* Layer 1: Skeleton Front View */}
        <div
          className={[
            'diagram-layer skeleton-layer skeleton-front-layer',
            ...(zoomSource === 'skeleton' ? zoomSourceClasses : []),
            transitionPhase === 'flipping-to-back' ? 'layer-flip-out-front' : '',
            transitionPhase === 'flipping-to-front' ? 'layer-flip-in-front' : '',
            activeView !== 'skeleton' && !isFlipping && !(isZooming && zoomSource === 'skeleton') ? 'layer-hidden' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={zoomSource === 'skeleton' ? zoomFrame : undefined}
          dangerouslySetInnerHTML={skeletonFrontMarkup}
        />

        {/* Layer 2: Skeleton Back View */}
        <div
          className={[
            'diagram-layer skeleton-layer skeleton-back-layer',
            ...(zoomSource === 'skeleton-back' ? zoomSourceClasses : []),
            transitionPhase === 'flipping-to-back' ? 'layer-flip-in-back' : '',
            transitionPhase === 'flipping-to-front' ? 'layer-flip-out-back' : '',
            activeView !== 'skeleton-back' && !isFlipping && !(isZooming && zoomSource === 'skeleton-back') ? 'layer-hidden' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={zoomSource === 'skeleton-back' ? zoomFrame : undefined}
          dangerouslySetInnerHTML={skeletonBackMarkup}
        />

        {/* Layer 3: Detailed Skull View (Front, Left or Right) */}
        <div
          className={detailLayerClass('skull')}
          dangerouslySetInnerHTML={
            activeView === 'skull-left'
              ? skullLeftMarkup
              : activeView === 'skull-right'
                ? skullRightMarkup
                : skullFrontMarkup
          }
        />

        {/* Layer 4: Detailed Spine & Ribs View (Anterior) */}
        <div
          className={detailLayerClass('ribs')}
          style={zoomSource === 'ribs' ? zoomFrame : undefined}
          dangerouslySetInnerHTML={ribsSpineFrontMarkup}
        />

        {/* Layers 5–10: Feet, Scapulae and Hip Bones, one layer per side */}
        <div className={detailLayerClass('l_foot')} dangerouslySetInnerHTML={leftFootMarkup} />
        <div className={detailLayerClass('r_foot')} dangerouslySetInnerHTML={rightFootMarkup} />
        <div className={detailLayerClass('l_scapula')} dangerouslySetInnerHTML={scapulaLeftMarkup} />
        <div className={detailLayerClass('r_scapula')} dangerouslySetInnerHTML={scapulaRightMarkup} />
        <div className={detailLayerClass('l_oscoxa')} dangerouslySetInnerHTML={leftHipMarkup} />
        <div className={detailLayerClass('r_oscoxa')} dangerouslySetInnerHTML={rightHipMarkup} />

        {/* Layer 11: The open vertebra, in the superior view of its type */}
        <div className={detailLayerClass('vertebra')} dangerouslySetInnerHTML={vertebraMarkup(openVertebraId)} />

        <div
          className={[
            'detail-title max-w-[calc(100%-2rem)] truncate rounded-full border border-slate-200 bg-white/95 px-4 py-1.5 text-sm font-semibold text-slate-800 shadow-xs',
            isTitleVisible ? 'is-visible' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        >
          {title}
        </div>
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
                    // Narrow screens stack the dot over a slightly smaller label,
                    // which still hyphenates rather than spill out of a very
                    // narrow button. The size sits on the label because the
                    // global `button { font: inherit }` rule outranks Tailwind's
                    // text utilities on the button itself.
                    className={[
                      'flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2.5 text-xs font-semibold transition-colors duration-200 sm:flex-row sm:gap-2 sm:px-2 sm:py-3',
                      activePaint === option.state
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600',
                    ].join(' ')}
                  >
                    <span
                      className={`h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10 ${option.swatch}`}
                    />
                    <span className="max-w-full text-center leading-tight hyphens-auto [overflow-wrap:anywhere] max-sm:text-xs">
                      {option.label}
                    </span>
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
      <InfoPopup isOpen={keyOpen} title="Colour key" onClose={() => setKeyOpen(false)}>
        <ul className="space-y-3">
          {COLOUR_KEY.map((entry) => (
            <li key={entry.name} className="flex items-start gap-3">
              <span
                className="mt-0.5 h-4 w-4 shrink-0 rounded-full ring-1 ring-black/15"
                style={{ background: entry.colour }}
              />
              <span>
                <span className="block font-semibold text-slate-900">{entry.name}</span>
                <span className="block text-xs text-slate-500">{entry.meaning}</span>
              </span>
            </li>
          ))}
        </ul>
      </InfoPopup>

      <NotesPopup
	      isOpen={notesOpen}
        caseName={caseData?.caseName}
        initialValue={caseData?.fieldNotes ?? ''}
        onSave={handleSaveNotes}
        onCancel={() => setNotesOpen(false)}
      />
    </div>
  )
}

export default SkeletonPage
