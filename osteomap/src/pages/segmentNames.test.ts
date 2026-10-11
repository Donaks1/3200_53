import { describe, expect, it } from 'vitest'
import { compareSegments, currentSegmentStates, describeSegment, segmentLabel, zoneColumn } from './segmentNames'
import { LEGACY_SEGMENT_IDS } from './legacySegmentIds'
import { hierarchy, skeletonBack, skeletonFront } from './skeletonDrawings'

describe('segmentLabel', () => {
  it('names bones and zones the same way everywhere', () => {
    expect(segmentLabel('left_femur')).toBe('Left femur')
    expect(segmentLabel('left_femur_zone_11')).toBe('Left femur — zone 11')
    expect(segmentLabel('right_ulna_zone_ab')).toBe('Right ulna — zone ab')
    expect(segmentLabel('vertebra_t7_zone_2')).toBe('T7 vertebra — zone 2')
    expect(segmentLabel('sacrum')).toBe('Sacrum')
    expect(segmentLabel('left_hip_bone')).toBe('Left hip bone')
    expect(segmentLabel('right_rib_12_zone_3')).toBe('Right rib 12 — zone 3')
    expect(segmentLabel('mandible_zone_left_3')).toBe('Mandible — left zone 3')
    expect(segmentLabel('cranium_zone_5')).toBe('Cranium — zone 5')
    expect(segmentLabel('cranium_zone_right_orbit')).toBe('Cranium — right orbit')
    expect(segmentLabel('left_scaphoid')).toBe('Left scaphoid')
    expect(segmentLabel('left_hand_distal_phalanx_4')).toBe('Left hand distal phalanx 4')
    expect(segmentLabel('right_foot_proximal_phalanx_1_zone_2')).toBe('Right foot proximal phalanx 1 — zone 2')
    expect(segmentLabel('left_hand_digit_1')).toBe('Left hand digit 1 (thumb)')
    expect(segmentLabel('spine_and_ribs')).toBe('Spine and ribs')
  })

  it('shows an id outside the convention as it is', () => {
    expect(segmentLabel('l_femur')).toBe('l_femur')
    expect(describeSegment('l_femur')).toBeNull()
  })
})

describe('describeSegment', () => {
  it('gives the columns the export writes', () => {
    const columns = (id: string) => {
      const name = describeSegment(id)!
      return [name.region, name.bone, name.side, zoneColumn(name)]
    }
    expect(columns('left_femur')).toEqual(['Leg', 'Femur', 'Left', 'Whole bone'])
    expect(columns('left_femur_zone_11')).toEqual(['Leg', 'Femur', 'Left', '11'])
    expect(columns('mandible_zone_right_7')).toEqual(['Skull', 'Mandible', 'Right', '7'])
    expect(columns('cranium_zone_left_orbit')).toEqual(['Skull', 'Cranium', 'Left', 'Orbit'])
    expect(columns('right_hand_middle_phalanx_3')).toEqual(['Hand', 'Middle phalanx 3', 'Right', 'Whole bone'])
    expect(columns('vertebra_l5')).toEqual(['Spine', 'L5 vertebra', '', 'Whole bone'])
  })

  it('tells regions, bones and zones apart', () => {
    expect(describeSegment('left_hand')?.kind).toBe('region')
    expect(describeSegment('left_metacarpal_1')?.kind).toBe('bone')
    expect(describeSegment('left_metacarpal_1_zone_2')?.kind).toBe('zone')
  })
})

describe('compareSegments', () => {
  it('orders head to toe, each bone before its zones, zones by number, left before right', () => {
    const ids = ['right_femur', 'left_femur_zone_10', 'skull', 'left_femur_zone_2', 'left_femur', 'right_foot', 'vertebra_c2', 'x_unknown']
    expect([...ids].sort(compareSegments)).toEqual([
      'skull', 'vertebra_c2', 'left_femur', 'left_femur_zone_2', 'left_femur_zone_10', 'right_femur', 'right_foot', 'x_unknown',
    ])
  })
})

describe('ids in the drawings', () => {
  it('all follow the naming convention', () => {
    const outside = [...hierarchy().ids].filter((id) => !describeSegment(id))
    expect(outside).toEqual([])
  })

  it('give the clavicles and sacrum the same zones from behind as from the front', () => {
    const zonesOf = (markup: string, bone: string) =>
      [...new DOMParser().parseFromString(markup, 'image/svg+xml').querySelectorAll(`[id="${bone}"] [id]`)].map((el) => el.id).sort()
    for (const bone of ['left_clavicle', 'right_clavicle', 'sacrum']) {
      expect(zonesOf(skeletonBack, bone)).toHaveLength(3)
      expect(zonesOf(skeletonBack, bone)).toEqual(zonesOf(skeletonFront, bone))
    }
  })

  it('include every id an earlier version could have saved, under its new name', () => {
    const missing = Object.entries(LEGACY_SEGMENT_IDS).filter(([, id]) => !hierarchy().ids.has(id))
    expect(missing).toEqual([])
  })
})

describe('currentSegmentStates', () => {
  it('moves old ids to new ones, keeping the more specific of two that name one shape', () => {
    expect(currentSegmentStates({ l_femur: 'complete', l_patella: 'absent', l_patella_1: 'fragmentary', sternum: 'complete' })).toEqual({
      left_femur: 'complete',
      left_patella: 'fragmentary',
      sternum: 'complete',
    })
  })

  it('leaves current and unknown ids alone', () => {
    expect(currentSegmentStates({ left_femur: 'absent', mystery: 'complete' })).toEqual({ left_femur: 'absent', mystery: 'complete' })
  })
})
