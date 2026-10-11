import { describe, expect, it, vi } from 'vitest'
import { saveAs } from 'file-saver'
import { db } from './db'
import { applyImport, exportDatabaseCSV, findImportConflicts, previewDatabaseCSV } from './exportImport'

vi.mock('file-saver', () => ({ saveAs: vi.fn() }))
import type { CaseRecord } from './types'

function makeCase(overrides: Partial<CaseRecord>): CaseRecord {
  return {
    caseId: 'case-default',
    caseName: 'Default specimen',
    dateCreated: '2026-01-01T00:00:00.000Z',
    dateModified: '2026-01-01T00:00:00.000Z',
    fieldNotes: '',
    sex: '',
    ageGroup: 'adult',
    segmentStates: {},
    contextId: 'ctx-default',
    ...overrides
  }
}

const DEFAULT_HEADER = 'Site,Context,Specimen,Sex,Age Group,Field Notes,Date Created,Date Modified,Site ID,Context ID,Specimen ID'

function csvBlob(rows: string[], header = DEFAULT_HEADER, inventory: string[] = []): Blob {
  const lines = ['SPECIMENS', header, ...rows]
  if (inventory.length) lines.push('', 'INVENTORY', ...inventory)
  return new Blob([lines.join('\n')], { type: 'text/csv' })
}

describe('import workflow merge of PR #78 + #85', () => {
  it('supports context/site remapping and duplicate conflict resolutions in one import', async () => {
    await db.sites.add({ siteId: 'site-existing', siteName: 'Tell A' })
    await db.contexts.add({ contextId: 'ctx-existing', contextName: 'Layer 1', siteId: 'site-existing' })
    await db.cases.bulkAdd([
      makeCase({ caseId: 'existing-id', caseName: 'Stored by ID', contextId: 'ctx-existing' }),
      makeCase({ caseId: 'name-conflict-existing', caseName: 'Name Conflict', contextId: 'ctx-existing' })
    ])

    const file = csvBlob([
      'Tell A,Layer 1,Imported by ID,,adult,,2026-01-02T00:00:00.000Z,2026-01-02T00:00:00.000Z,site-import,ctx-import,existing-id',
      'Tell A,Layer 1,Name Conflict,,adult,,2026-01-03T00:00:00.000Z,2026-01-03T00:00:00.000Z,site-import,ctx-import,new-id-1',
      'Tell A,Layer 1,Fresh Specimen,,adult,,2026-01-03T00:00:00.000Z,2026-01-03T00:00:00.000Z,site-import,ctx-import,new-id-2'
    ])

    const preview = await previewDatabaseCSV(file)
    const choices = { sites: { 'site-import': 'site-existing' }, contexts: { 'ctx-import': 'ctx-existing' } }

    const conflicts = await findImportConflicts(preview, choices)
    expect(conflicts).toHaveLength(2)
    expect(conflicts.map((conflict) => conflict.incoming.caseId).sort()).toEqual(['existing-id', 'new-id-1'])
    expect(conflicts.every((conflict) => conflict.incoming.contextId === 'ctx-existing')).toBe(true)

    const idConflict = conflicts.find((conflict) => conflict.incoming.caseId === 'existing-id')
    const nameConflict = conflicts.find((conflict) => conflict.incoming.caseId === 'new-id-1')
    expect(idConflict).toBeTruthy()
    expect(nameConflict).toBeTruthy()

    const result = await applyImport(preview, choices, {
      'existing-id': 'rename',
      'new-id-1': 'replace'
    })

    expect(result).toMatchObject({
      sitesCreated: 0,
      contextsCreated: 0,
      casesImported: 3,
      casesSkipped: 0,
      casesReplaced: 1
    })

    const allCases = await db.cases.toArray()
    expect(allCases.some((caseRecord) => caseRecord.caseId === 'name-conflict-existing')).toBe(false)

    const replaced = allCases.find((caseRecord) => caseRecord.caseId === 'new-id-1')
    expect(replaced?.caseName).toBe('Name Conflict')
    expect(replaced?.contextId).toBe('ctx-existing')

    const renamed = allCases.find((caseRecord) => caseRecord.caseName === idConflict?.suggestedName)
    expect(renamed).toBeTruthy()
    expect(renamed?.caseId).not.toBe('existing-id')

    const existingStillPresent = allCases.find((caseRecord) => caseRecord.caseId === 'existing-id')
    expect(existingStillPresent?.caseName).toBe('Stored by ID')

    const fresh = allCases.find((caseRecord) => caseRecord.caseId === 'new-id-2')
    expect(fresh?.contextId).toBe('ctx-existing')
  })

  it('aborts without writes when duplicate resolutions are missing', async () => {
    await db.sites.add({ siteId: 'site-existing', siteName: 'Tell A' })
    await db.contexts.add({ contextId: 'ctx-existing', contextName: 'Layer 1', siteId: 'site-existing' })
    await db.cases.add(makeCase({ caseId: 'existing-id', caseName: 'Stored by ID', contextId: 'ctx-existing' }))

    const file = csvBlob([
      'Tell A,Layer 1,Imported by ID,,adult,,2026-01-02T00:00:00.000Z,2026-01-02T00:00:00.000Z,site-import,ctx-import,existing-id'
    ])

    const preview = await previewDatabaseCSV(file)
    const choices = { sites: { 'site-import': 'site-existing' }, contexts: { 'ctx-import': 'ctx-existing' } }

    await expect(applyImport(preview, choices, {})).rejects.toThrow('Missing decision for duplicate case')

    const [sites, contexts, cases] = await Promise.all([db.sites.toArray(), db.contexts.toArray(), db.cases.toArray()])
    expect(sites).toHaveLength(1)
    expect(contexts).toHaveLength(1)
    expect(cases).toHaveLength(1)
    expect(cases[0].caseId).toBe('existing-id')
    expect(cases[0].caseName).toBe('Stored by ID')
  })
})

const SPECIMEN_HEADER = 'Specimen ID,Site ID,Context ID,Site,Context,Specimen,Sex,Age Group,Field Notes,Date Created,Date Modified'
// What the app writes in front of the specimens' states in the INVENTORY table.
const INVENTORY_HEADER = 'Region,Bone,Side,Zone,Segment ID'

describe('two-table CSV format (SPECIMENS + INVENTORY)', () => {

  it('reads specimen details and links bone states by specimen name column', async () => {
    const file = csvBlob([
      'case-1,site-1,ctx-1,wdwd,as,ccs,male,child,"Notes, with comma",2026-08-23T00:00:00.000Z,2026-09-28T00:00:00.000Z',
      'case-2,site-1,ctx-1,wdwd,as,uwa_02,female,adult,,2026-09-01T00:00:00.000Z,2026-09-02T00:00:00.000Z'
    ], SPECIMEN_HEADER, [
      `${INVENTORY_HEADER},ccs,UWA_02`,
      'Leg,Femur,Right,Whole bone,right_femur,absent,Complete',
      'Shoulder,Scapula,Left,1,left_scapula_zone_1,,fragmentary',
      'Arm,Ulna,Right,Whole bone,right_ulna,complete,'
    ])

    const preview = await previewDatabaseCSV(file)
    expect(preview.cases).toHaveLength(2)
    expect(preview.cases.find((c) => c.caseId === 'case-1')).toMatchObject({
      caseName: 'ccs',
      sex: 'male',
      ageGroup: 'child',
      fieldNotes: 'Notes, with comma',
      contextId: 'ctx-1',
      segmentStates: { right_femur: 'absent', right_ulna: 'complete' }
    })
    expect(preview.cases.find((c) => c.caseId === 'case-2')?.segmentStates).toEqual({
      right_femur: 'complete',
      left_scapula_zone_1: 'fragmentary'
    })
    expect(preview.unrecognisedSegments).toEqual([])
  })

  it('accepts title rows padded with empty cells, as Excel saves them', async () => {
    const text = [
      'SPECIMENS,,,,,,,,,,',
      SPECIMEN_HEADER,
      'case-1,,,Tell A,Layer 1,One,,adult,,,',
      ',,,,,,,,,,',
      'INVENTORY,,,,,,,,,,',
      `${INVENTORY_HEADER},One,,,,,`,
      'Arm,Ulna,Right,Whole bone,right_ulna,complete,,,,,'
    ].join('\r\n')

    const preview = await previewDatabaseCSV(new Blob([text], { type: 'text/csv' }))
    expect(preview.cases[0].segmentStates).toEqual({ right_ulna: 'complete' })
  })

  it('imports specimens with no bones when the INVENTORY table is absent, generating missing site/context IDs', async () => {
    const file = csvBlob([
      'case-1,,,Tell A,Layer 1,One,,adult,,,',
      'case-2,,,Tell A,Layer 1,Two,,adult,,,',
      'case-3,,,Tell A,Layer 2,Three,,adult,,,'
    ], SPECIMEN_HEADER)

    const preview = await previewDatabaseCSV(file)
    expect(preview.sites).toHaveLength(1)
    expect(preview.contexts).toHaveLength(2)
    expect(preview.cases).toHaveLength(3)
    expect(preview.cases[0].contextId).toBe(preview.cases[1].contextId)
    expect(preview.cases.every((c) => Object.keys(c.segmentStates).length === 0)).toBe(true)
  })

  it('rejects an unknown bone state', async () => {
    const file = csvBlob(['case-1,,,Tell A,Layer 1,One,,adult,,,'], SPECIMEN_HEADER, [`${INVENTORY_HEADER},One`, 'Arm,Ulna,Right,Whole bone,right_ulna,broken'])

    await expect(previewDatabaseCSV(file)).rejects.toThrow('"broken" is not a valid state for right_ulna on specimen "One"')
  })

  it('rejects an inventory column for a specimen that is not in the SPECIMENS table', async () => {
    const file = csvBlob(['case-1,,,Tell A,Layer 1,One,,adult,,,'], SPECIMEN_HEADER, [`${INVENTORY_HEADER},One,Ghost`, 'Arm,Ulna,Right,Whole bone,right_ulna,complete,absent'])

    await expect(previewDatabaseCSV(file)).rejects.toThrow(`column "Ghost" that doesn't match any specimen`)
  })

  it('still accepts a Specimen ID as an inventory column header', async () => {
    const file = csvBlob(['case-1,,,Tell A,Layer 1,One,,adult,,,'], SPECIMEN_HEADER, [`${INVENTORY_HEADER},case-1`, 'Arm,Ulna,Right,Whole bone,right_ulna,complete'])

    const preview = await previewDatabaseCSV(file)
    expect(preview.cases[0].segmentStates).toEqual({ right_ulna: 'complete' })
  })

  it('tells apart specimens that share a name using "name (Site / Context)" headers', async () => {
    const file = csvBlob([
      'case-1,,,Tell A,Layer 1,ccs,,adult,,,',
      'case-2,,,Tell A,Layer 2,ccs,,adult,,,'
    ], SPECIMEN_HEADER, [
      `${INVENTORY_HEADER},ccs (Tell A / Layer 1),ccs (Tell A / Layer 2)`,
      'Arm,Ulna,Right,Whole bone,right_ulna,complete,absent'
    ])

    const preview = await previewDatabaseCSV(file)
    expect(preview.cases.find((c) => c.caseId === 'case-1')?.segmentStates).toEqual({ right_ulna: 'complete' })
    expect(preview.cases.find((c) => c.caseId === 'case-2')?.segmentStates).toEqual({ right_ulna: 'absent' })
  })

  it('rejects a specimen without a Specimen ID', async () => {
    const file = csvBlob([',,,Tell A,Layer 1,One,,adult,,,'], SPECIMEN_HEADER)

    await expect(previewDatabaseCSV(file)).rejects.toThrow('Specimen "One" is missing its Specimen ID')
  })

  it('rejects a file without the SPECIMENS table', async () => {
    const file = new Blob(['Site,Context,Specimen\nTell A,Layer 1,One'], { type: 'text/csv' })

    await expect(previewDatabaseCSV(file)).rejects.toThrow('missing the SPECIMENS table')
  })

  it('rejects an INVENTORY table that never says which bone a row is', async () => {
    const file = csvBlob(['case-1,,,Tell A,Layer 1,One,,adult,,,'], SPECIMEN_HEADER, ['Region,Bone,One', 'Arm,Ulna,complete'])

    await expect(previewDatabaseCSV(file)).rejects.toThrow('needs a "Segment ID" column')
  })
})

describe('files exported before the bone ids were standardised', () => {
  it('reads the old "Bone" column, moving each id to the one it has now', async () => {
    const file = csvBlob(['case-1,,,Tell A,Layer 1,One,,adult,,,'], SPECIMEN_HEADER, [
      'Bone,One',
      'l_femur_11,complete',
      'r_dist_iv,absent',
      'cranium_5_1,fragmentary',
      'c3_2,complete',
      'l_oscoxa,absent',
      'spine_ribs,complete'
    ])

    const preview = await previewDatabaseCSV(file)
    expect(preview.cases[0].segmentStates).toEqual({
      left_femur_zone_11: 'complete',
      right_hand_distal_phalanx_4: 'absent',
      cranium_zone_5: 'fragmentary',
      vertebra_c3_zone_2: 'complete',
      left_hip_bone: 'absent',
      spine_and_ribs: 'complete'
    })
    expect(preview.unrecognisedSegments).toEqual([])
  })

  it('keeps the more specific mark where two old ids named one shape', async () => {
    const file = csvBlob(['case-1,,,Tell A,Layer 1,One,,adult,,,'], SPECIMEN_HEADER, [
      'Bone,One', 'l_patella,absent', 'l_patella_1,complete'
    ])

    const preview = await previewDatabaseCSV(file)
    expect(preview.cases[0].segmentStates).toEqual({ left_patella: 'complete' })
  })

  it('keeps ids that no drawing has, and says which', async () => {
    const file = csvBlob(['case-1,,,Tell A,Layer 1,One,,adult,,,'], SPECIMEN_HEADER, [
      `${INVENTORY_HEADER},One`, 'Not recognised,,,,left_femur_zone_99,absent', 'Leg,Femur,Left,Whole bone,left_femur,complete'
    ])

    const preview = await previewDatabaseCSV(file)
    expect(preview.cases[0].segmentStates).toEqual({ left_femur_zone_99: 'absent', left_femur: 'complete' })
    expect(preview.unrecognisedSegments).toEqual(['left_femur_zone_99'])
  })
})

describe('export/import round trip', () => {
  it('re-imports an exported database with the same specimens and bone states', async () => {
    let exported: Blob | undefined
    vi.mocked(saveAs).mockImplementation((blob) => { exported = blob as Blob })

    await db.sites.add({ siteId: 'site-1', siteName: 'wdwd' })
    await db.contexts.add({ contextId: 'ctx-1', contextName: 'as', siteId: 'site-1' })
    await db.cases.bulkAdd([
      makeCase({ caseId: 'case-1', caseName: 'ccs', contextId: 'ctx-1', fieldNotes: 'Line one\nLine "two"', segmentStates: { left_femur: 'complete', right_femur: 'absent' } }),
      makeCase({ caseId: 'case-2', caseName: 'uwa_02', contextId: 'ctx-1', segmentStates: {} })
    ])

    await exportDatabaseCSV()
    expect(exported).toBeDefined()

    const text = await exported!.text()
    expect(text.split('\n')[0]).toBe('SPECIMENS')
    expect(text).toContain(
      '\n\nINVENTORY\nRegion,Bone,Side,Zone,Segment ID,ccs,uwa_02\n' +
      'Leg,Femur,Left,Whole bone,left_femur,complete,\n' +
      'Leg,Femur,Right,Whole bone,right_femur,absent,'
    )

    const preview = await previewDatabaseCSV(exported!)
    expect(preview.cases).toEqual(await db.cases.toArray())
    expect(preview.sites).toEqual(await db.sites.toArray())
    expect(preview.contexts).toEqual(await db.contexts.toArray())
  })
})

describe('export labels for duplicate specimen names', () => {
  it('labels repeated names with site and context, and falls back to the ID when those repeat too', async () => {
    let exported: Blob | undefined
    vi.mocked(saveAs).mockImplementation((blob) => { exported = blob as Blob })

    await db.sites.add({ siteId: 'site-1', siteName: 'Tell A' })
    await db.contexts.bulkAdd([
      { contextId: 'ctx-1', contextName: 'Layer 1', siteId: 'site-1' },
      { contextId: 'ctx-2', contextName: 'Layer 2', siteId: 'site-1' }
    ])
    await db.cases.bulkAdd([
      makeCase({ caseId: 'case-1', caseName: 'ccs', contextId: 'ctx-1', segmentStates: { right_ulna: 'complete' } }),
      makeCase({ caseId: 'case-2', caseName: 'ccs', contextId: 'ctx-2', segmentStates: { right_ulna: 'absent' } }),
      makeCase({ caseId: 'case-3', caseName: 'ccs', contextId: 'ctx-2', segmentStates: { right_ulna: 'fragmentary' } }),
      makeCase({ caseId: 'case-4', caseName: 'solo', contextId: 'ctx-1', segmentStates: {} })
    ])

    await exportDatabaseCSV()
    const text = await exported!.text()
    expect(text).toContain(`${INVENTORY_HEADER},ccs (Tell A / Layer 1),ccs (Tell A / Layer 2) [case-2],ccs (Tell A / Layer 2) [case-3],solo`)

    const preview = await previewDatabaseCSV(exported!)
    expect(preview.cases).toEqual(await db.cases.toArray())
  })
})

describe('INVENTORY rows', () => {
  async function exportedInventory(segmentStates: CaseRecord['segmentStates']): Promise<string[]> {
    let exported: Blob | undefined
    vi.mocked(saveAs).mockImplementation((blob) => { exported = blob as Blob })
    await db.sites.add({ siteId: 'site-1', siteName: 'Tell A' })
    await db.contexts.add({ contextId: 'ctx-1', contextName: 'Layer 1', siteId: 'site-1' })
    await db.cases.add(makeCase({ caseId: 'case-1', caseName: 'One', contextId: 'ctx-1', segmentStates }))
    await exportDatabaseCSV()
    const text = await exported!.text()
    return text.slice(text.indexOf('INVENTORY')).split('\n').slice(2)
  }

  it('says what each row is in words, head to toe, with each bone before its zones', async () => {
    const rows = await exportedInventory({
      right_foot_distal_phalanx_1_zone_2: 'absent',
      left_femur_zone_11: 'fragmentary',
      left_femur_zone_2: 'complete',
      mandible_zone_left_3: 'absent',
      vertebra_t7_zone_1: 'complete',
      cranium_zone_left_orbit: 'complete'
    })

    expect(rows).toEqual([
      'Skull,Cranium,Left,Orbit,cranium_zone_left_orbit,complete',
      'Skull,Mandible,Left,3,mandible_zone_left_3,absent',
      'Spine,T7 vertebra,,1,vertebra_t7_zone_1,complete',
      'Leg,Femur,Left,2,left_femur_zone_2,complete',
      'Leg,Femur,Left,11,left_femur_zone_11,fragmentary',
      'Foot,Distal phalanx 1,Right,2,right_foot_distal_phalanx_1_zone_2,absent'
    ])
  })

  it('lists every bone a mark on a whole region covers, and they import back as those bones', async () => {
    const rows = await exportedInventory({ left_carpals: 'complete', pelvis: 'absent' })

    expect(rows).toEqual([
      'Hand,Scaphoid,Left,Whole bone,left_scaphoid,complete',
      'Hand,Lunate,Left,Whole bone,left_lunate,complete',
      'Hand,Triquetrum,Left,Whole bone,left_triquetrum,complete',
      'Hand,Pisiform,Left,Whole bone,left_pisiform,complete',
      'Hand,Trapezium,Left,Whole bone,left_trapezium,complete',
      'Hand,Trapezoid,Left,Whole bone,left_trapezoid,complete',
      'Hand,Capitate,Left,Whole bone,left_capitate,complete',
      'Hand,Hamate,Left,Whole bone,left_hamate,complete',
      'Pelvis,Hip bone,Left,Whole bone,left_hip_bone,absent',
      'Pelvis,Hip bone,Right,Whole bone,right_hip_bone,absent'
    ])

    const file = csvBlob(['case-2,,,Tell A,Layer 1,Two,,adult,,,'], SPECIMEN_HEADER, [`${INVENTORY_HEADER},Two`, ...rows])
    const preview = await previewDatabaseCSV(file)
    expect(Object.keys(preview.cases[0].segmentStates)).toHaveLength(10)
    expect(preview.cases[0].segmentStates).toMatchObject({ left_scaphoid: 'complete', right_hip_bone: 'absent' })
  })
})
