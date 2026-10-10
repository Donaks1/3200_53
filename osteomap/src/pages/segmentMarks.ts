import type { SegmentState } from '../db/types'

// The same bone is drawn in several places at once, at different levels of
// detail: a hip bone is one shape on the full skeleton and twelve zones in its
// own drawing, the skull is one group there and three drawings of zones of its
// own. A mark is saved against an id once, so what it covers has to be worked
// out against every drawing together rather than whichever one was tapped.
// That is what this hierarchy is: each id's parent and children, gathered from
// all of the drawings at once.
export type Hierarchy = {
  parent: Map<string, string>
  children: Map<string, string[]>
}

// A drawing and, where its top level belongs to something it doesn't draw
// itself (a skull view's bones are all part of the skull), the id it belongs to.
export type HierarchySource = { markup: string; within?: string }

// Teeth and cartilage are drawn so the skeleton reads as one, but are never
// recorded, so they are left out of the hierarchy altogether.
export const UNRECORDED = '#teeth, [id*="cartilage"]'
export const isUnrecorded = (element: Element) => element.closest(UNRECORDED) !== null
export const isUnrecordedId = (id: string) => id.startsWith('teeth') || id.includes('cartilage')

export function hierarchyOf(sources: HierarchySource[]): Hierarchy {
  // Every group or bone each id is drawn directly inside, in the order the
  // drawings first show them.
  const owners = new Map<string, string[]>()

  for (const { markup, within } of sources) {
    const root = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement

    for (const element of root.querySelectorAll('[id]')) {
      if (element.closest('defs') || isUnrecorded(element)) continue

      let owner: string | undefined = within
      for (let node = element.parentElement; node && node !== root; node = node.parentElement) {
        if (node.id) {
          owner = node.id
          break
        }
      }
      const known = owners.get(element.id) ?? []
      if (owner && owner !== element.id && !known.includes(owner)) known.push(owner)
      owners.set(element.id, known)
    }
  }

  const parent = new Map<string, string>()
  for (const [id, known] of owners) {
    if (known.length) parent.set(id, known[0])
  }

  // A drawing with less detail can skip a level another one draws: rib 1's
  // zones sit straight in the rib cage on the full skeleton, but inside rib 1
  // in the spine view. The deeper of the two is where they really belong.
  for (const [id, known] of owners) {
    const deepest = known.find((owner) =>
      known.every((other) => other === owner || ancestorsOf({ parent }, owner).includes(other)),
    )
    if (deepest) parent.set(id, deepest)
  }

  const children = new Map<string, string[]>()
  for (const id of owners.keys()) {
    const owner = parent.get(id)
    if (owner) children.set(owner, [...(children.get(owner) ?? []), id])
  }
  return { parent, children }
}

const childrenOf = (hierarchy: Hierarchy, id: string) => hierarchy.children.get(id) ?? []

// Nearest first. Stops rather than loops should two drawings ever nest a pair
// of ids each inside the other.
function ancestorsOf(hierarchy: Pick<Hierarchy, 'parent'>, id: string): string[] {
  const ancestors: string[] = []
  for (let node = hierarchy.parent.get(id); node && node !== id && !ancestors.includes(node); node = hierarchy.parent.get(node)) {
    ancestors.push(node)
  }
  return ancestors
}

function descendantsOf(hierarchy: Hierarchy, id: string): string[] {
  const descendants: string[] = []
  const visit = (node: string) => {
    for (const child of childrenOf(hierarchy, node)) {
      if (child === id || descendants.includes(child)) continue
      descendants.push(child)
      visit(child)
    }
  }
  visit(id)
  return descendants
}

// Marks `id` (or clears it, for null) and everything inside it, whatever was
// marked before. A mark on something it sits inside is broken up into the
// parts it no longer covers, each keeping the state it had, so clearing one
// zone of a hip bone marked whole leaves the other eleven marked, and clearing
// it out of a pelvis marked whole leaves the other hip bone marked too.
//
// Records come out with nothing marked twice: no id is saved alongside an id
// it sits inside.
export function withMark(
  hierarchy: Hierarchy,
  states: Record<string, SegmentState>,
  id: string,
  state: SegmentState | null,
): Record<string, SegmentState> {
  const next = { ...states }
  const path = [...ancestorsOf(hierarchy, id).reverse(), id]

  let inherited: SegmentState | undefined
  path.slice(0, -1).forEach((node, index) => {
    if (next[node]) {
      inherited = next[node]
      delete next[node]
    }
    if (!inherited) return
    for (const child of childrenOf(hierarchy, node)) {
      if (child !== path[index + 1] && !next[child]) next[child] = inherited
    }
  })

  for (const descendant of descendantsOf(hierarchy, id)) delete next[descendant]
  if (state) next[id] = state
  else delete next[id]
  return next
}

// The state `id` shows: its own, or that of whatever it sits inside. Failing
// that, one its parts show, preferring `preferred` so that tapping a bone in
// the colour some of its zones already wear clears them rather than repaints.
export function coveringState(
  hierarchy: Hierarchy,
  states: Record<string, SegmentState>,
  id: string,
  preferred: SegmentState,
): SegmentState | null {
  for (const node of [id, ...ancestorsOf(hierarchy, id)]) {
    if (states[node]) return states[node]
  }
  const parts = descendantsOf(hierarchy, id).flatMap((descendant) => states[descendant] ?? [])
  return parts.includes(preferred) ? preferred : (parts[0] ?? null)
}

// Records saved before marks were kept apart could hold a bone and some of its
// zones at once. The more specific mark wins, which is also how they were drawn.
export function normalisedStates(
  hierarchy: Hierarchy,
  states: Record<string, SegmentState>,
): Record<string, SegmentState> {
  const overlaps = Object.keys(states).some((id) => ancestorsOf(hierarchy, id).some((node) => states[node]))
  if (!overlaps) return states

  return Object.entries(states)
    .sort(([a], [b]) => ancestorsOf(hierarchy, a).length - ancestorsOf(hierarchy, b).length)
    .reduce((next, [id, state]) => withMark(hierarchy, next, id, state), {} as Record<string, SegmentState>)
}

// The elements of one drawing that show the saved marks. A mark on something
// the drawing doesn't show whole (the skull in a skull view, the pelvis in a
// hip bone's) lands on the parts of it the drawing does show. So does one on a
// group that also holds teeth or cartilage, which keep their grey.
export function markedElements(
  hierarchy: Hierarchy,
  svg: Element,
  states: Record<string, SegmentState>,
): { element: Element; state: SegmentState }[] {
  const drawn = new Map<string, Element>()
  for (const element of svg.querySelectorAll('[id]')) {
    if (!drawn.has(element.id)) drawn.set(element.id, element)
  }

  const marked: { element: Element; state: SegmentState }[] = []
  const mark = (id: string, state: SegmentState) => {
    const element = drawn.get(id)
    if (element && isUnrecorded(element)) return
    if (element && !element.querySelector(UNRECORDED)) {
      marked.push({ element, state })
      return
    }
    for (const child of childrenOf(hierarchy, id)) {
      if (!states[child]) mark(child, state)
    }
  }

  for (const [id, state] of Object.entries(states)) mark(id, state)
  return marked
}

// The ids "everything in this drawing" means: whatever sits at the top of it,
// skipping teeth and cartilage. Marking these marks all the rest by inclusion.
export function topLevelIds(svg: Element): string[] {
  return [...svg.querySelectorAll('[id]')]
    .filter((element) => {
      if (element.closest('defs') || isUnrecorded(element)) return false
      for (let node = element.parentElement; node && node !== svg; node = node.parentElement) {
        if (node.id) return false
      }
      return true
    })
    .map((element) => element.id)
}

// Where a zone sits among its bone's, for naming it: "zone 3 of 12".
export function zonePosition(hierarchy: Hierarchy, id: string): { bone: string; index: number; count: number } | null {
  const bone = hierarchy.parent.get(id)
  if (!bone || childrenOf(hierarchy, id).length > 0) return null
  const zones = childrenOf(hierarchy, bone)
  return { bone, index: zones.indexOf(id) + 1, count: zones.length }
}
