import { describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { db } from './db'

describe('database upgrade to version 2', () => {
  it('moves marks saved under the old bone ids to the standard ones', async () => {
    // A database as version 1 of the app left it.
    db.close()
    await Dexie.delete('OsteoMapDB')
    const old = new Dexie('OsteoMapDB')
    old.version(1).stores({
      sites: 'siteId, siteName',
      contexts: 'contextId, contextName, siteId',
      cases: 'caseId, dateCreated, dateModified, fieldNotes, sex, ageGroup, contextId',
    })
    await old.table('cases').add({
      caseId: 'case-1',
      caseName: 'SK-001',
      contextId: 'ctx-1',
      dateCreated: '2026-10-01T00:00:00.000Z',
      dateModified: '2026-10-01T00:00:00.000Z',
      fieldNotes: 'kept as it was',
      sex: 'female',
      ageGroup: 'adult',
      segmentStates: { l_femur: 'complete', l_patella_1: 'absent', cranium_5: 'fragmentary', c3_2: 'complete', r_scp: 'absent' },
    })
    old.close()

    await db.open()

    expect(await db.cases.get('case-1')).toMatchObject({
      caseName: 'SK-001',
      fieldNotes: 'kept as it was',
      segmentStates: {
        left_femur: 'complete',
        left_patella: 'absent',
        cranium_zone_5: 'fragmentary',
        vertebra_c3_zone_2: 'complete',
        right_scaphoid: 'absent',
      },
    })
  })
})
