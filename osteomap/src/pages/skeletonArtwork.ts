import skullFrontSource from '../assets/skull_front.svg?raw'
import skullLeftSource from '../assets/skull_left.svg?raw'
import skullRightSource from '../assets/skull_right.svg?raw'
import leftFootSource from '../assets/left_foot.svg?raw'
import rightFootSource from '../assets/right_foot.svg?raw'
import scapulaLeftSource from '../assets/scapula_left.svg?raw'
import scapulaRightSource from '../assets/scapula_right.svg?raw'
import leftHipSource from '../assets/left_pelvis.svg?raw'
import rightHipSource from '../assets/right_pelvis.svg?raw'
import cervicalVertebraSource from '../assets/cervical_vertebra.svg?raw'
import thoracicVertebraSource from '../assets/thoracic_vertebra.svg?raw'
import lumbarVertebraSource from '../assets/lumbar_vertebra.svg?raw'
import type { SegmentState } from '../db/types'

// A vertebra's zones are drawn in a superior view of its type. One drawing
// stands in for every vertebra of that type, so each vertebra gets its own copy
// with the ids rewritten to its own: zones recorded on C3 are c3_1 to c3_4,
// and never show up on C5.
export const VERTEBRA_DRAWINGS = [
  { match: /^c[1-7]$/, count: 7, prefix: 'c', type: 'Cervical', source: cervicalVertebraSource, zonePrefix: 'cervical_vertebra' },
  { match: /^t([1-9]|1[0-2])$/, count: 12, prefix: 't', type: 'Thoracic', source: thoracicVertebraSource, zonePrefix: 'thoracic_vertebra' },
  { match: /^l[1-5]$/, count: 5, prefix: 'l', type: 'Lumbar', source: lumbarVertebraSource, zonePrefix: 'lumbar_vertebra' },
]

export const vertebraDrawingFor = (vertebraId: string) =>
  VERTEBRA_DRAWINGS.find((drawing) => drawing.match.test(vertebraId))

// Readies the front skeleton (already class-scoped by the caller) so marks
// made in any other drawing land on it, for both the skeleton page and the
// skeleton previews.
export function prepareSkeletonFront(markup: string): string {
  return withDetailSkull(
    withFirstRibsGrouped(
      // In zone mode the scapula opens a drawing of its own, where l_scapula_1
      // is one of nine zones. Here the same id names the outline of the whole
      // bone, so it gives the id up rather than light the full scapula whenever
      // that one zone is marked. The bone itself is still the l_scapula group.
      markup.replace(/ id="[lr]_scapula_1"/g, ''),
    ),
  )
}

// Every other rib is one shape here, but rib 1 is drawn as its three zones,
// loose in the rib cage. The spine view groups them as the bone l_rib1 /
// r_rib1, and so does this, so a mark on that bone lands here too.
function withFirstRibsGrouped(markup: string): string {
  const skeleton = new DOMParser().parseFromString(markup, 'image/svg+xml')

  for (const side of ['l', 'r']) {
    const cage = skeleton.getElementById(`${side}_ribs`)
    const zones = cage ? [...cage.children].filter((child) => child.id.startsWith(`${side}_rib1_`)) : []
    if (!cage || !zones.length || skeleton.getElementById(`${side}_rib1`)) continue

    const rib = skeleton.createElementNS('http://www.w3.org/2000/svg', 'g')
    rib.id = `${side}_rib1`
    zones[0].before(rib)
    rib.append(...zones)
  }

  return new XMLSerializer().serializeToString(skeleton.documentElement)
}

// Some drawings show a bone only whole, while its zones are recorded in a
// drawing of their own: the feet, scapulae and hip bones on the full skeleton
// (front and back), the skull from behind, and the vertebrae on the full
// skeleton and in the spine view. Each such
// bone is listed here with its zones, and each zone with the bones between it
// and the whole, nearest first (a foot's zones sit inside its bones).
const ZONE_SETS = new Map<string, Map<string, string[]>>([
  ['skull', new Map([...zonesIn(skullFrontSource), ...zonesIn(skullLeftSource), ...zonesIn(skullRightSource)])],
  ['l_foot', zonesIn(leftFootSource)],
  ['r_foot', zonesIn(rightFootSource)],
  ['l_scapula', zonesIn(scapulaLeftSource)],
  ['r_scapula', zonesIn(scapulaRightSource)],
  ['l_oscoxa', zonesIn(leftHipSource)],
  ['r_oscoxa', zonesIn(rightHipSource)],
  ...VERTEBRA_DRAWINGS.flatMap(({ count, prefix, source, zonePrefix }) =>
    Array.from({ length: count }, (_, index): [string, Map<string, string[]>] => {
      const vertebraId = `${prefix}${index + 1}`
      return [vertebraId, zonesIn(source.replaceAll(`${zonePrefix}_`, `${vertebraId}_`))]
    }),
  ),
])

function zonesIn(source: string): Map<string, string[]> {
  const drawing = new DOMParser().parseFromString(source.replace(/<\?xml[^?]*\?>/, ''), 'image/svg+xml')
  const root = drawing.documentElement
  const zones = new Map<string, string[]>()

  for (const shape of drawing.querySelectorAll('path[id], polygon[id], circle[id], ellipse[id]')) {
    const bones: string[] = []
    for (let node = shape.parentElement; node && node !== root; node = node.parentElement) {
      if (node.id) bones.push(node.id)
    }
    zones.set(shape.id, bones)
  }
  return zones
}

// What a bone's zones add up to when the bone itself isn't marked: the zones'
// state when every one of them is marked alike, or 'partial' when only some
// are marked or they differ, the cue to open the bone and see which.
export type ZoneSummary = SegmentState | 'partial'

export function summariseZones(states: Record<string, SegmentState>): Map<string, ZoneSummary> {
  const summaries = new Map<string, ZoneSummary>()

  for (const [boneId, zones] of ZONE_SETS) {
    if (states[boneId]) continue
    const marks = [...zones].map(([zone, bones]) => states[zone] ?? bones.map((bone) => states[bone]).find(Boolean))
    if (!marks.some(Boolean)) continue
    summaries.set(boneId, marks.every((mark) => mark === marks[0]) ? marks[0]! : 'partial')
  }
  return summaries
}

// The drawings of a bone that show it only whole: every element carrying its
// id that has none of its zones inside it.
export function zoneStandIns(root: ParentNode, boneId: string): Element[] {
  const zones = ZONE_SETS.get(boneId)
  if (!zones) return []
  return [...root.querySelectorAll(`#${CSS.escape(boneId)}`)].filter(
    (element) => ![...element.querySelectorAll('[id]')].some((child) => zones.has(child.id)),
  )
}

// The full skeleton's own skull is a separate drawing, zoned differently from
// the skull views, so a mark made there had nothing to land on when zoomed back
// out. Redrawing it from the front skull drawing gives the full skeleton the
// very same zones, under the very same ids, so every mark shows in both places
// without any mapping between them to keep up to date.
//
// The front skull is fitted over the box the skeleton's own skull filled, and
// takes that artwork's class so it is outlined and filled like the bones around it.
function withDetailSkull(skeletonMarkup: string): string {
  const skeleton = new DOMParser().parseFromString(skeletonMarkup, 'image/svg+xml')
  const region = skeleton.getElementById('skull')
  const detail = new DOMParser().parseFromString(skullFrontSource.replace(/<\?xml[^?]*\?>/, ''), 'image/svg+xml')
  const regionPaths = region ? [...region.querySelectorAll('path')] : []
  const detailPaths = [...detail.querySelectorAll('path')]

  // Anything this can't measure (another kind of shape, a transform, an
  // unfamiliar path command) leaves the skeleton's own skull in place rather
  // than drawing it wrongly.
  if (!region || !isPlainPaths(region) || !isPlainPaths(detail.documentElement)) return skeletonMarkup
  const target = boundsOfPaths(regionPaths)
  const content = boundsOfPaths(detailPaths)
  if (!target || !content) return skeletonMarkup

  const scaleX = target.width / content.width
  const scaleY = target.height / content.height
  const fit: Affine = { a: scaleX, d: scaleY, e: target.x - content.x * scaleX, f: target.y - content.y * scaleY }

  const moved = detailPaths.map((path) => transformPath(path.getAttribute('d') ?? '', fit))
  if (moved.some((d) => d === null)) return skeletonMarkup

  const className = regionPaths[0].getAttribute('class')
  detailPaths.forEach((path, index) => {
    path.setAttribute('d', moved[index]!)
    if (className) path.setAttribute('class', className)
  })

  region.replaceChildren(
    ...[...detail.documentElement.children].filter((child) => child.tagName.toLowerCase() !== 'defs'),
  )

  return new XMLSerializer().serializeToString(skeleton.documentElement)
}

const isPlainPaths = (root: Element) =>
  root.querySelector('[transform], polygon, polyline, rect, circle, ellipse, line, use, image, text') === null &&
  !root.hasAttribute('transform')

type Bounds = { x: number; y: number; width: number; height: number }

// Only scale and translation, which is all a fit needs: x' = a·x + e and
// y' = d·y + f.
type Affine = { a: number; d: number; e: number; f: number }

type Segment = { command: string; args: number[] }

const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Z: 0 }

// Splits path data into one segment per command, spelling out the repeats
// that path data lets you leave implicit (a moveto's extra pairs are linetos).
// Returns null for anything beyond the commands Illustrator writes here.
function parsePath(d: string): Segment[] | null {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []
  const segments: Segment[] = []
  let index = 0

  while (index < tokens.length) {
    let command = tokens[index++]
    const arity = ARITY[command.toUpperCase()]
    if (arity === undefined) return null

    if (arity === 0) {
      segments.push({ command, args: [] })
      continue
    }

    do {
      const args = tokens.slice(index, index + arity).map(Number)
      if (args.length < arity || args.some(Number.isNaN)) return null
      segments.push({ command, args })
      index += arity
      if (command === 'M') command = 'L'
      if (command === 'm') command = 'l'
    } while (index < tokens.length && !/[a-zA-Z]/.test(tokens[index]))
  }

  return segments
}

const round = (value: number) => Math.round(value * 1000) / 1000

// Moves a path's own coordinates rather than wrapping it in a transform, so its
// outline keeps the stroke weight of the drawing it is placed into.
function transformPath(d: string, { a, d: dy, e, f }: Affine): string | null {
  const segments = parsePath(d)
  if (!segments) return null

  return segments
    .map(({ command, args }) => {
      const relative = command === command.toLowerCase()
      const upper = command.toUpperCase()
      const moved = args.map((value, index) => {
        const isX = upper === 'H' || (upper !== 'V' && index % 2 === 0)
        const scaled = value * (isX ? a : dy)
        return round(relative ? scaled : scaled + (isX ? e : f))
      })
      return command + moved.join(' ')
    })
    .join('')
}

// The box the paths cover, curves included: each cubic is sampled along its
// length rather than bounded by its control points, which can sit well outside it.
function boundsOfPaths(paths: Element[]): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const include = (x: number, y: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  for (const path of paths) {
    const segments = parsePath(path.getAttribute('d') ?? '')
    if (!segments) return null

    let x = 0
    let y = 0
    let startX = 0
    let startY = 0
    let lastControlX = 0
    let lastControlY = 0
    let previous = ''

    for (const { command, args } of segments) {
      const relative = command === command.toLowerCase()
      const ox = relative ? x : 0
      const oy = relative ? y : 0
      const upper = command.toUpperCase()

      if (upper === 'M' || upper === 'L') {
        x = ox + args[0]
        y = oy + args[1]
        if (upper === 'M') {
          startX = x
          startY = y
        }
        include(x, y)
      } else if (upper === 'H') {
        x = ox + args[0]
        include(x, y)
      } else if (upper === 'V') {
        y = oy + args[0]
        include(x, y)
      } else if (upper === 'Z') {
        x = startX
        y = startY
      } else {
        // A smooth curve's first control point mirrors the previous curve's
        // second one, or sits on the current point if there wasn't one.
        const smooth = upper === 'S'
        const reflects = previous === 'C' || previous === 'S'
        const c1x = smooth ? (reflects ? 2 * x - lastControlX : x) : ox + args[0]
        const c1y = smooth ? (reflects ? 2 * y - lastControlY : y) : oy + args[1]
        const rest = smooth ? args : args.slice(2)
        const c2x = ox + rest[0]
        const c2y = oy + rest[1]
        const endX = ox + rest[2]
        const endY = oy + rest[3]

        for (let step = 1; step <= 16; step++) {
          const t = step / 16
          const u = 1 - t
          include(
            u * u * u * x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * endX,
            u * u * u * y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * endY,
          )
        }

        lastControlX = c2x
        lastControlY = c2y
        x = endX
        y = endY
      }
      previous = upper
    }
  }

  if (!Number.isFinite(minX) || maxX === minX || maxY === minY) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
