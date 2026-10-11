import { describe, it, expect } from 'vitest'
import { coveringState, hierarchyOf, markedElements, normalisedStates, topLevelIds, withMark } from './segmentMarks'

// A miniature of the real drawings: the full skeleton shows the pelvis as two
// whole hip bones and rib 1's zones straight in the rib cage, while the detail
// drawings show a hip bone's zones and rib 1 as a bone of its own.
const skeleton = `<svg xmlns="http://www.w3.org/2000/svg" id="Main">
  <g id="pelvis"><g id="left_hip_bone"><path/></g><g id="right_hip_bone"><path/></g></g>
  <g id="spine_and_ribs">
    <g id="left_ribs"><path id="left_rib_2"/><path id="left_rib_1_zone_1"/><path id="left_rib_1_zone_2"/></g>
    <g id="thoracic_vertebrae"><path id="vertebra_t1"/><path id="cartilage"/></g>
  </g>
  <g id="left_femur"><path id="left_femur_zone_1"/><path id="left_femur_zone_2"/></g>
</svg>`
const leftHip = `<svg xmlns="http://www.w3.org/2000/svg"><g id="left_hip_bone">
  <path id="left_hip_bone_zone_1"/><path id="left_hip_bone_zone_2"/><path id="left_hip_bone_zone_3"/>
</g></svg>`
const ribs = `<svg xmlns="http://www.w3.org/2000/svg">
  <g id="left_ribs"><g id="left_rib_2"><path id="left_rib_2_zone_1"/></g><g id="left_rib_1"><path id="left_rib_1_zone_1"/><path id="left_rib_1_zone_2"/></g></g>
  <g id="thoracic_vertebrae"><g id="vertebra_t1"><path/></g><g id="cartilage"><path id="cartilage_2"/></g></g>
</svg>`

const hierarchy = hierarchyOf([{ markup: skeleton }, { markup: leftHip }, { markup: ribs, within: 'spine_and_ribs' }])
const svgOf = (markup: string) => new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement

describe('hierarchyOf', () => {
  it('joins the drawings into one tree', () => {
    expect(hierarchy.parent.get('left_hip_bone_zone_3')).toBe('left_hip_bone')
    expect(hierarchy.parent.get('left_hip_bone')).toBe('pelvis')
    expect(hierarchy.children.get('left_rib_2')).toEqual(['left_rib_2_zone_1'])
  })

  it('places an id at the deepest level any drawing shows it', () => {
    expect(hierarchy.parent.get('left_rib_1_zone_1')).toBe('left_rib_1')
    expect(hierarchy.children.get('left_ribs')).toEqual(['left_rib_2', 'left_rib_1'])
  })

  it('leaves cartilage out', () => {
    expect(hierarchy.children.get('thoracic_vertebrae')).toEqual(['vertebra_t1'])
  })
})

describe('withMark', () => {
  it('replaces whatever was marked inside a bone marked whole', () => {
    const states = withMark(hierarchy, { left_hip_bone_zone_3: 'absent', left_femur_zone_1: 'absent' }, 'pelvis', 'complete')
    expect(states).toEqual({ pelvis: 'complete', left_femur_zone_1: 'absent' })
  })

  it('clears one zone out of a bone marked further up, keeping the rest marked', () => {
    const states = withMark(hierarchy, { pelvis: 'complete' }, 'left_hip_bone_zone_3', null)
    expect(states).toEqual({ right_hip_bone: 'complete', left_hip_bone_zone_1: 'complete', left_hip_bone_zone_2: 'complete' })
  })

  it('repaints one zone out of a bone marked whole', () => {
    const states = withMark(hierarchy, { left_femur: 'complete' }, 'left_femur_zone_2', 'fragmentary')
    expect(states).toEqual({ left_femur_zone_1: 'complete', left_femur_zone_2: 'fragmentary' })
  })

  it('splits a region marked whole in a drawing that never names it', () => {
    const states = withMark(hierarchy, { spine_and_ribs: 'complete' }, 'left_rib_1_zone_2', null)
    expect(states).toEqual({ thoracic_vertebrae: 'complete', left_rib_2: 'complete', left_rib_1_zone_1: 'complete' })
  })
})

describe('coveringState', () => {
  it('finds a mark on the bone or anything it sits inside', () => {
    expect(coveringState(hierarchy, { pelvis: 'absent' }, 'left_hip_bone_zone_2', 'complete')).toBe('absent')
  })

  it('falls back to the zones, preferring the colour being painted', () => {
    const states = { left_femur_zone_1: 'absent', left_femur_zone_2: 'complete' } as const
    expect(coveringState(hierarchy, states, 'left_femur', 'complete')).toBe('complete')
    expect(coveringState(hierarchy, states, 'left_femur', 'fragmentary')).toBe('absent')
    expect(coveringState(hierarchy, {}, 'left_femur', 'complete')).toBeNull()
  })
})

describe('normalisedStates', () => {
  it('lets the more specific of two overlapping marks win', () => {
    const states = normalisedStates(hierarchy, { pelvis: 'complete', left_hip_bone: 'complete', left_hip_bone_zone_3: 'absent' })
    expect(states).toEqual({ right_hip_bone: 'complete', left_hip_bone_zone_1: 'complete', left_hip_bone_zone_2: 'complete', left_hip_bone_zone_3: 'absent' })
  })

  it('leaves a record without overlaps as it is', () => {
    const states = { left_femur: 'complete' } as const
    expect(normalisedStates(hierarchy, states)).toBe(states)
  })
})

describe('markedElements', () => {
  it('marks the parts a drawing shows of something it does not name', () => {
    const marked = markedElements(hierarchy, svgOf(leftHip), { pelvis: 'absent' })
    expect(marked.map(({ element }) => element.id)).toEqual(['left_hip_bone'])
  })

  it('steps around cartilage, which keeps its grey', () => {
    const marked = markedElements(hierarchy, svgOf(ribs), { thoracic_vertebrae: 'complete' })
    expect(marked.map(({ element }) => element.id)).toEqual(['vertebra_t1'])
  })

  it('finds rib 1 by its zones where it has no group of its own', () => {
    const marked = markedElements(hierarchy, svgOf(skeleton), { left_rib_1: 'complete' })
    expect(marked.map(({ element }) => element.id)).toEqual(['left_rib_1_zone_1', 'left_rib_1_zone_2'])
  })
})

describe('topLevelIds', () => {
  it('lists what sits at the top of a drawing, skipping cartilage', () => {
    expect(topLevelIds(svgOf(skeleton))).toEqual(['pelvis', 'spine_and_ribs', 'left_femur'])
    expect(topLevelIds(svgOf(ribs))).toEqual(['left_ribs', 'thoracic_vertebrae'])
  })
})
