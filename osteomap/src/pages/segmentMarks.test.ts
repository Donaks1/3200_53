import { describe, it, expect } from 'vitest'
import { coveringState, hierarchyOf, markedElements, normalisedStates, topLevelIds, withMark } from './segmentMarks'

// A miniature of the real drawings: the full skeleton shows the pelvis as two
// whole hip bones and rib 1's zones straight in the rib cage, while the detail
// drawings show a hip bone's zones and rib 1 as a bone of its own.
const skeleton = `<svg xmlns="http://www.w3.org/2000/svg" id="Main">
  <g id="pelvis"><g id="l_oscoxa"><path/></g><g id="r_oscoxa"><path/></g></g>
  <g id="spine_ribs">
    <g id="l_ribs"><path id="l_rib2"/><path id="l_rib1_1"/><path id="l_rib1_2"/></g>
    <g id="thoracic_vertebrae"><path id="t1"/><path id="cartilage"/></g>
  </g>
  <g id="l_femur"><path id="l_femur_1"/><path id="l_femur_2"/></g>
</svg>`
const leftHip = `<svg xmlns="http://www.w3.org/2000/svg"><g id="l_oscoxa">
  <path id="l_oscoxa_1"/><path id="l_oscoxa_2"/><path id="l_oscoxa_3"/>
</g></svg>`
const ribs = `<svg xmlns="http://www.w3.org/2000/svg">
  <g id="l_ribs"><g id="l_rib2"><path id="l_rib2_1"/></g><g id="l_rib1"><path id="l_rib1_1"/><path id="l_rib1_2"/></g></g>
  <g id="thoracic_vertebrae"><g id="t1"><path/></g><g id="cartilage"><path id="cartilage_1"/></g></g>
</svg>`

const hierarchy = hierarchyOf([{ markup: skeleton }, { markup: leftHip }, { markup: ribs, within: 'spine_ribs' }])
const svgOf = (markup: string) => new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement

describe('hierarchyOf', () => {
  it('joins the drawings into one tree', () => {
    expect(hierarchy.parent.get('l_oscoxa_3')).toBe('l_oscoxa')
    expect(hierarchy.parent.get('l_oscoxa')).toBe('pelvis')
    expect(hierarchy.children.get('l_rib2')).toEqual(['l_rib2_1'])
  })

  it('places an id at the deepest level any drawing shows it', () => {
    expect(hierarchy.parent.get('l_rib1_1')).toBe('l_rib1')
    expect(hierarchy.children.get('l_ribs')).toEqual(['l_rib2', 'l_rib1'])
  })

  it('leaves cartilage out', () => {
    expect(hierarchy.children.get('thoracic_vertebrae')).toEqual(['t1'])
  })
})

describe('withMark', () => {
  it('replaces whatever was marked inside a bone marked whole', () => {
    const states = withMark(hierarchy, { l_oscoxa_3: 'absent', l_femur_1: 'absent' }, 'pelvis', 'complete')
    expect(states).toEqual({ pelvis: 'complete', l_femur_1: 'absent' })
  })

  it('clears one zone out of a bone marked further up, keeping the rest marked', () => {
    const states = withMark(hierarchy, { pelvis: 'complete' }, 'l_oscoxa_3', null)
    expect(states).toEqual({ r_oscoxa: 'complete', l_oscoxa_1: 'complete', l_oscoxa_2: 'complete' })
  })

  it('repaints one zone out of a bone marked whole', () => {
    const states = withMark(hierarchy, { l_femur: 'complete' }, 'l_femur_2', 'fragmentary')
    expect(states).toEqual({ l_femur_1: 'complete', l_femur_2: 'fragmentary' })
  })

  it('splits a region marked whole in a drawing that never names it', () => {
    const states = withMark(hierarchy, { spine_ribs: 'complete' }, 'l_rib1_2', null)
    expect(states).toEqual({ thoracic_vertebrae: 'complete', l_rib2: 'complete', l_rib1_1: 'complete' })
  })
})

describe('coveringState', () => {
  it('finds a mark on the bone or anything it sits inside', () => {
    expect(coveringState(hierarchy, { pelvis: 'absent' }, 'l_oscoxa_2', 'complete')).toBe('absent')
  })

  it('falls back to the zones, preferring the colour being painted', () => {
    const states = { l_femur_1: 'absent', l_femur_2: 'complete' } as const
    expect(coveringState(hierarchy, states, 'l_femur', 'complete')).toBe('complete')
    expect(coveringState(hierarchy, states, 'l_femur', 'fragmentary')).toBe('absent')
    expect(coveringState(hierarchy, {}, 'l_femur', 'complete')).toBeNull()
  })
})

describe('normalisedStates', () => {
  it('lets the more specific of two overlapping marks win', () => {
    const states = normalisedStates(hierarchy, { pelvis: 'complete', l_oscoxa: 'complete', l_oscoxa_3: 'absent' })
    expect(states).toEqual({ r_oscoxa: 'complete', l_oscoxa_1: 'complete', l_oscoxa_2: 'complete', l_oscoxa_3: 'absent' })
  })

  it('leaves a record without overlaps as it is', () => {
    const states = { l_femur: 'complete' } as const
    expect(normalisedStates(hierarchy, states)).toBe(states)
  })
})

describe('markedElements', () => {
  it('marks the parts a drawing shows of something it does not name', () => {
    const marked = markedElements(hierarchy, svgOf(leftHip), { pelvis: 'absent' })
    expect(marked.map(({ element }) => element.id)).toEqual(['l_oscoxa'])
  })

  it('steps around cartilage, which keeps its grey', () => {
    const marked = markedElements(hierarchy, svgOf(ribs), { thoracic_vertebrae: 'complete' })
    expect(marked.map(({ element }) => element.id)).toEqual(['t1'])
  })

  it('finds rib 1 by its zones where it has no group of its own', () => {
    const marked = markedElements(hierarchy, svgOf(skeleton), { l_rib1: 'complete' })
    expect(marked.map(({ element }) => element.id)).toEqual(['l_rib1_1', 'l_rib1_2'])
  })
})

describe('topLevelIds', () => {
  it('lists what sits at the top of a drawing, skipping cartilage', () => {
    expect(topLevelIds(svgOf(skeleton))).toEqual(['pelvis', 'spine_ribs', 'l_femur'])
    expect(topLevelIds(svgOf(ribs))).toEqual(['l_ribs', 'thoracic_vertebrae'])
  })
})
