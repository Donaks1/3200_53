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
import { VERTEBRA_DRAWINGS, prepareSkeletonFront, vertebraDrawingFor } from './skeletonArtwork'
import { hierarchyOf, type Hierarchy } from './segmentMarks'

// Every drawing, readied to be inlined into the skeleton page, and the
// hierarchy of bones and zones they add up to. The drawings already carry the
// standard ids (see segmentNames), so all that happens here is fitting them
// together.

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
// it, which is what the rest of the page already understands as a bone drawn
// as one shape, so selection and labelling fall out of the existing model.
function wrapLooseShapes(container: Element) {
  for (const child of [...container.children]) {
    if (child.tagName.toLowerCase() === 'g' || !child.id) continue

    const group = container.ownerDocument.createElementNS(SVG_NS, 'g')
    group.id = child.id
    child.removeAttribute('id')
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

// Readied so marks made in the skull drawings land on it too (see skeletonArtwork).
export const skeletonFront = prepareSkeletonFront(scopeSvg(skeletonFrontSource, 'front'))
export const skeletonBack = scopeSvg(skeletonBackSource, 'back')

export const skullFront = scopeSvg(skullFrontSource, 'skull-front')
export const skullLeft = scopeSvg(skullLeftSource, 'skull-left')
export const skullRight = scopeSvg(skullRightSource, 'skull-right')

// The ribs/spine drawing is the same artwork as the #spine_and_ribs group in
// skeleton_front.svg, with the same ids: a rib painted here is stored under
// that id and repainted in the full skeleton view from it. The export leaves
// each vertebra as a loose path inside #thoracic_vertebrae and friends, which
// would make bone mode select every vertebra of a kind at once, so each is
// wrapped in a group named after it.
function groupVertebrae(markup: string): string {
  return editSvg(markup, (svg) => {
    // The root carries id="spine_and_ribs", which is also a paintable group in
    // the skeleton view — leaving it would let a click there paint the whole cage.
    svg.removeAttribute('id')

    for (const containerId of ['thoracic_vertebrae', 'lumbar_vertebrae', 'cervical_vertebrae']) {
      const container = svg.ownerDocument.getElementById(containerId)
      if (!container) continue

      // A vertebra's zones are in the drawing of its type, which a zone-mode
      // tap on it opens.
      wrapLooseShapes(container)
      for (const group of container.children) {
        if (vertebraDrawingFor(group.id)) group.setAttribute('data-zone-drawing', '')
      }
    }
  })
}

export const ribsSpineFront = groupVertebrae(scopeSvg(ribsSpineFrontSource, 'ribs'))

// The foot as a whole is the left_foot / right_foot group the skeleton view
// marks, so marking the whole foot there shows on every bone here.
export const leftFoot = editSvg(scopeSvg(leftFootSource, 'left-foot'), (svg) => gatherInto(svg, 'left_foot'))
export const rightFoot = editSvg(scopeSvg(rightFootSource, 'right-foot'), (svg) => gatherInto(svg, 'right_foot'))

// The scapula and the hip bone are each a single bone drawn as loose zones.
export const scapulaLeft = editSvg(scopeSvg(scapulaLeftSource, 'scapula-left'), (svg) => gatherInto(svg, 'left_scapula'))
export const scapulaRight = editSvg(scopeSvg(scapulaRightSource, 'scapula-right'), (svg) => gatherInto(svg, 'right_scapula'))
export const leftHip = editSvg(scopeSvg(leftHipSource, 'hip-left'), (svg) => gatherInto(svg, 'left_hip_bone'))
export const rightHip = editSvg(scopeSvg(rightHipSource, 'hip-right'), (svg) => gatherInto(svg, 'right_hip_bone'))

// One drawing stands for every vertebra of its type; each vertebra gets its
// own copy with the zone ids rewritten to its own (vertebra_c3_zone_1 ..).
// Built on first use.
const vertebraDrawings = new Map<string, string>()

export function vertebraSvg(vertebraId: string): string | null {
  const drawing = vertebraDrawingFor(vertebraId)
  if (!drawing) return null

  let svg = vertebraDrawings.get(vertebraId)
  if (!svg) {
    const relabelled = scopeSvg(drawing.source, 'vertebra').replaceAll(`${drawing.zonePrefix}_`, `${vertebraId}_`)
    svg = editSvg(relabelled, (root) => gatherInto(root, vertebraId))
    vertebraDrawings.set(vertebraId, svg)
  }
  return svg
}

// Where every id sits among the others, across all the drawings at once (see
// segmentMarks). Built on first use, as it reads every drawing.
let segmentHierarchy: Hierarchy | null = null

export function hierarchy(): Hierarchy {
  segmentHierarchy ??= hierarchyOf([
    { markup: skeletonFront },
    { markup: skeletonBack },
    // The skull views draw nothing but the skull, and the spine view nothing
    // but the rib cage, so neither names the whole it is drawing.
    { markup: skullFront, within: 'skull' },
    { markup: skullLeft, within: 'skull' },
    { markup: skullRight, within: 'skull' },
    { markup: ribsSpineFront, within: 'spine_and_ribs' },
    { markup: leftFoot },
    { markup: rightFoot },
    { markup: scapulaLeft },
    { markup: scapulaRight },
    { markup: leftHip },
    { markup: rightHip },
    ...VERTEBRA_DRAWINGS.flatMap(({ count, prefix }) =>
      Array.from({ length: count }, (_, index) => ({ markup: vertebraSvg(`${prefix}${index + 1}`) ?? '' })),
    ),
  ])
  return segmentHierarchy
}
