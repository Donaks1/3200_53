import type { SegmentState } from '../db/types'
import { LEGACY_SEGMENT_IDS } from './legacySegmentIds'

// Every bone and zone has one id, used alike in the drawings, the database and
// the CSV export, and everything a person reads is worked out from it:
//
//   [left_|right_]<element>[_zone_[left_|right_]<zone>]
//
//   left_femur                  Left femur
//   left_femur_zone_11          Left femur — zone 11
//   vertebra_t7_zone_2          T7 vertebra — zone 2
//   mandible_zone_left_3        Mandible — left zone 3
//   left_hand_distal_phalanx_4  Left hand distal phalanx 4
//
// The side is the subject's, not the viewer's. Elements are named in full,
// counted the anatomical way (digits 1–5 from the thumb or big toe, ribs 1–12
// down, vertebrae C1–C7, T1–T12, L1–L5), and zones keep the zonation method's
// number. A bone drawn as one shape has no zones. CONTRIBUTING.md has the
// full list.

export type Region = 'Skull' | 'Spine' | 'Thorax' | 'Shoulder' | 'Arm' | 'Hand' | 'Pelvis' | 'Leg' | 'Foot'

export type SegmentKind = 'region' | 'bone' | 'zone'

export type SegmentName = {
  id: string
  kind: SegmentKind
  region: Region
  // The element alone, as the export's Bone column has it beside the region.
  bone: string
  side: '' | 'Left' | 'Right'
  zone: string
}

type ElementType = {
  pattern: RegExp
  region: Region
  // Given the number the pattern captures, if any.
  name: (number: string) => string
  // How the app names it, where no region sits beside it. Defaults to `name`.
  label?: (number: string) => string
  // A region of several bones rather than one bone.
  group?: true
}

const DIGITS = ['', 'thumb', 'index finger', 'middle finger', 'ring finger', 'little finger']

const named = (name: string) => () => name
const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
const bonesNamed = (region: Region, ids: string[]): ElementType[] =>
  ids.map((id) => ({ pattern: new RegExp(`^${id}$`), region, name: named(capitalised(id.replaceAll('_', ' '))) }))
const phalanges = (limb: 'hand' | 'foot', region: Region): ElementType[] =>
  ['proximal', 'middle', 'distal'].map((part) => ({
    pattern: new RegExp(`^${limb}_${part}_phalanx_(\\d)$`),
    region,
    name: (n) => `${capitalised(part)} phalanx ${n}`,
    label: (n) => `${limb} ${part} phalanx ${n}`,
  }))

// Head to toe, which is also the order the export lists them in.
const ELEMENTS: ElementType[] = [
  { pattern: /^skull$/, region: 'Skull', name: named('Skull'), group: true },
  { pattern: /^cranium$/, region: 'Skull', name: named('Cranium') },
  { pattern: /^mandible$/, region: 'Skull', name: named('Mandible') },

  { pattern: /^spine_and_ribs$/, region: 'Spine', name: named('Spine and ribs'), group: true },
  { pattern: /^cervical_vertebrae$/, region: 'Spine', name: named('Cervical vertebrae'), group: true },
  { pattern: /^vertebra_c(\d+)$/, region: 'Spine', name: (n) => `C${n} vertebra` },
  { pattern: /^thoracic_vertebrae$/, region: 'Spine', name: named('Thoracic vertebrae'), group: true },
  { pattern: /^vertebra_t(\d+)$/, region: 'Spine', name: (n) => `T${n} vertebra` },
  { pattern: /^lumbar_vertebrae$/, region: 'Spine', name: named('Lumbar vertebrae'), group: true },
  { pattern: /^vertebra_l(\d+)$/, region: 'Spine', name: (n) => `L${n} vertebra` },
  ...bonesNamed('Spine', ['sacrum', 'coccyx']),

  { pattern: /^ribs$/, region: 'Thorax', name: named('Ribs'), group: true },
  { pattern: /^rib_(\d+)$/, region: 'Thorax', name: (n) => `Rib ${n}` },
  ...bonesNamed('Thorax', ['sternum']),

  ...bonesNamed('Shoulder', ['clavicle', 'scapula']),
  ...bonesNamed('Arm', ['humerus', 'radius', 'ulna']),

  { pattern: /^hand$/, region: 'Hand', name: named('Hand'), group: true },
  { pattern: /^carpals$/, region: 'Hand', name: named('Carpals'), group: true },
  ...bonesNamed('Hand', ['scaphoid', 'lunate', 'triquetrum', 'pisiform', 'trapezium', 'trapezoid', 'capitate', 'hamate']),
  {
    pattern: /^hand_digit_(\d)$/,
    region: 'Hand',
    name: (n) => `Digit ${n} (${DIGITS[Number(n)]})`,
    label: (n) => `hand digit ${n} (${DIGITS[Number(n)]})`,
    group: true,
  },
  { pattern: /^metacarpal_(\d)$/, region: 'Hand', name: (n) => `Metacarpal ${n}` },
  ...phalanges('hand', 'Hand'),

  { pattern: /^pelvis$/, region: 'Pelvis', name: named('Pelvis'), group: true },
  ...bonesNamed('Pelvis', ['hip_bone']),

  ...bonesNamed('Leg', ['femur', 'patella', 'tibia', 'fibula']),

  { pattern: /^foot$/, region: 'Foot', name: named('Foot'), group: true },
  ...bonesNamed('Foot', ['talus', 'calcaneus', 'navicular', 'cuboid', 'medial_cuneiform', 'intermediate_cuneiform', 'lateral_cuneiform']),
  { pattern: /^metatarsal_(\d)$/, region: 'Foot', name: (n) => `Metatarsal ${n}` },
  ...phalanges('foot', 'Foot'),
]

const ID_PATTERN = /^(?:(left|right)_)?(.+?)(?:_zone_(?:(left|right)_)?([a-z0-9]+))?$/
const SIDES = { left: 'Left', right: 'Right' } as const

type Parsed = SegmentName & { type: ElementType; typeIndex: number; number: string; zoneSide: boolean }

function parse(id: string): Parsed | null {
  const match = ID_PATTERN.exec(id)
  if (!match) return null
  const [, side, element, zoneSide, zone] = match

  for (const [typeIndex, type] of ELEMENTS.entries()) {
    const found = type.pattern.exec(element)
    if (!found) continue
    if (type.group && zone) return null
    const number = found[1] ?? ''
    return {
      id,
      kind: zone ? 'zone' : type.group ? 'region' : 'bone',
      region: type.region,
      bone: type.name(number),
      side: side ? SIDES[side as keyof typeof SIDES] : zoneSide ? SIDES[zoneSide as keyof typeof SIDES] : '',
      zone: zone ?? '',
      type,
      typeIndex,
      number,
      zoneSide: Boolean(zoneSide),
    }
  }
  return null
}

// What an id stands for, or null for an id outside the convention (one from a
// drawing or a file this version doesn't know).
export function describeSegment(id: string): SegmentName | null {
  const parsed = parse(id)
  if (!parsed) return null
  const { kind, region, bone, side, zone } = parsed
  return { id, kind, region, bone, side, zone }
}

// Numbered and lettered zones read "zone 11", "zone ab"; a named one reads as itself.
const zoneWords = (zone: string) => (/^(\d+|[a-z]{1,2})$/.test(zone) ? `zone ${zone}` : zone)

// How the app names a bone or zone: "Left femur — zone 11", "C3 vertebra",
// "Mandible — left zone 3". An id outside the convention is shown as it is.
export function segmentLabel(id: string): string {
  const parsed = parse(id)
  if (!parsed) return id

  const element = (parsed.type.label ?? parsed.type.name)(parsed.number)
  const sidedElement = parsed.side && !parsed.zoneSide ? `${parsed.side} ${element.charAt(0).toLowerCase()}${element.slice(1)}` : capitalised(element)
  if (!parsed.zone) return sidedElement
  const zoneSide = parsed.zoneSide ? `${parsed.side.toLowerCase()} ` : ''
  return `${sidedElement} — ${zoneSide}${zoneWords(parsed.zone)}`
}

// The export's Zone column: the zone, or "Whole bone" for a mark on the bone itself.
export function zoneColumn(name: SegmentName): string {
  if (!name.zone) return name.kind === 'region' ? 'All bones' : 'Whole bone'
  return /^(\d+|[a-z]{1,2})$/.test(name.zone) ? name.zone : capitalised(name.zone)
}

const byNumber = new Intl.Collator(undefined, { numeric: true })
const SIDE_ORDER = { '': 0, Left: 1, Right: 2 }

// Head to toe; within a bone the whole bone first, then its zones in number
// order; left before right. Ids outside the convention come last.
export function compareSegments(a: string, b: string): number {
  const x = parse(a)
  const y = parse(b)
  if (!x || !y) return x ? -1 : y ? 1 : byNumber.compare(a, b)
  return (
    x.typeIndex - y.typeIndex ||
    (Number(x.number) || 0) - (Number(y.number) || 0) ||
    SIDE_ORDER[x.side] - SIDE_ORDER[y.side] ||
    byNumber.compare(x.zone, y.zone)
  )
}

// The id a bone or zone has now, for one an earlier version saved.
export function currentSegmentId(id: string): string {
  return LEGACY_SEGMENT_IDS[id] ?? id
}

// A record's marks under the ids they have now. Where an earlier version had
// two ids for one thing (a bone drawn as one shape, and its only zone), the
// more specific mark is kept, as it was the one drawn on top.
export function currentSegmentStates(states: Record<string, SegmentState>): Record<string, SegmentState> {
  const next: Record<string, SegmentState> = {}
  const from: Record<string, string> = {}
  for (const [id, state] of Object.entries(states)) {
    const current = currentSegmentId(id)
    if (current in next && from[current].length >= id.length) continue
    next[current] = state
    from[current] = id
  }
  return next
}
