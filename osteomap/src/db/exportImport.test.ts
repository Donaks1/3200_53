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

describe('two-table CSV format (SPECIMENS + INVENTORY)', () => {
  const SPECIMEN_HEADER = 'Specimen ID,Site ID,Context ID,Site,Context,Specimen,Sex,Age Group,Field Notes,Date Created,Date Modified'

  it('reads specimen details and links bone states by specimen name column', async () => {
    const file = csvBlob([
      'case-1,site-1,ctx-1,wdwd,as,ccs,male,child,"Notes, with comma",2026-08-23T00:00:00.000Z,2026-09-28T00:00:00.000Z',
      'case-2,site-1,ctx-1,wdwd,as,uwa_02,female,adult,,2026-09-01T00:00:00.000Z,2026-09-02T00:00:00.000Z'
    ], SPECIMEN_HEADER, [
      'Bone,ccs,UWA_02',
      'r_femur,absent,Complete',
      'l_scapula_1,,fragmentary',
      'r_ulna,complete,'
    ])

    const preview = await previewDatabaseCSV(file)
    expect(preview.cases).toHaveLength(2)
    expect(preview.cases.find((c) => c.caseId === 'case-1')).toMatchObject({
      caseName: 'ccs',
      sex: 'male',
      ageGroup: 'child',
      fieldNotes: 'Notes, with comma',
      contextId: 'ctx-1',
      segmentStates: { r_femur: 'absent', r_ulna: 'complete' }
    })
    expect(preview.cases.find((c) => c.caseId === 'case-2')?.segmentStates).toEqual({
      r_femur: 'complete',
      l_scapula_1: 'fragmentary'
    })
  })

  it('accepts title rows padded with empty cells, as Excel saves them', async () => {
    const text = [
      'SPECIMENS,,,,,,,,,,',
      SPECIMEN_HEADER,
      'case-1,,,Tell A,Layer 1,One,,adult,,,',
      ',,,,,,,,,,',
      'INVENTORY,,,,,,,,,,',
      'Bone,One,,,,,,,,,',
      'r_ulna,complete,,,,,,,,,'
    ].join('\r\n')

    const preview = await previewDatabaseCSV(new Blob([text], { type: 'text/csv' }))
    expect(preview.cases[0].segmentStates).toEqual({ r_ulna: 'complete' })
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
    const file = csvBlob(['case-1,,,Tell A,Layer 1,One,,adult,,,'], SPECIMEN_HEADER, ['Bone,One', 'r_ulna,broken'])

    await expect(previewDatabaseCSV(file)).rejects.toThrow('"broken" is not a valid state for r_ulna on specimen "One"')
  })

  it('rejects an inventory column for a specimen that is not in the SPECIMENS table', async () => {
    const file = csvBlob(['case-1,,,Tell A,Layer 1,One,,adult,,,'], SPECIMEN_HEADER, ['Bone,One,Ghost', 'r_ulna,complete,absent'])

    await expect(previewDatabaseCSV(file)).rejects.toThrow(`column "Ghost" that doesn't match any specimen`)
  })

  it('still accepts a Specimen ID as an inventory column header', async () => {
    const file = csvBlob(['case-1,,,Tell A,Layer 1,One,,adult,,,'], SPECIMEN_HEADER, ['Bone,case-1', 'r_ulna,complete'])

    const preview = await previewDatabaseCSV(file)
    expect(preview.cases[0].segmentStates).toEqual({ r_ulna: 'complete' })
  })

  it('tells apart specimens that share a name using "name (Site / Context)" headers', async () => {
    const file = csvBlob([
      'case-1,,,Tell A,Layer 1,ccs,,adult,,,',
      'case-2,,,Tell A,Layer 2,ccs,,adult,,,'
    ], SPECIMEN_HEADER, [
      'Bone,ccs (Tell A / Layer 1),ccs (Tell A / Layer 2)',
      'r_ulna,complete,absent'
    ])

    const preview = await previewDatabaseCSV(file)
    expect(preview.cases.find((c) => c.caseId === 'case-1')?.segmentStates).toEqual({ r_ulna: 'complete' })
    expect(preview.cases.find((c) => c.caseId === 'case-2')?.segmentStates).toEqual({ r_ulna: 'absent' })
  })

  it('rejects a specimen without a Specimen ID', async () => {
    const file = csvBlob([',,,Tell A,Layer 1,One,,adult,,,'], SPECIMEN_HEADER)

    await expect(previewDatabaseCSV(file)).rejects.toThrow('Specimen "One" is missing its Specimen ID')
  })

  it('rejects a file without the SPECIMENS table', async () => {
    const file = new Blob(['Site,Context,Specimen\nTell A,Layer 1,One'], { type: 'text/csv' })

    await expect(previewDatabaseCSV(file)).rejects.toThrow('missing the SPECIMENS table')
  })
})

describe('export/import round trip', () => {
  it('re-imports an exported database with the same specimens and bone states', async () => {
    let exported: Blob | undefined
    vi.mocked(saveAs).mockImplementation((blob) => { exported = blob as Blob })

    await db.sites.add({ siteId: 'site-1', siteName: 'wdwd' })
    await db.contexts.add({ contextId: 'ctx-1', contextName: 'as', siteId: 'site-1' })
    await db.cases.bulkAdd([
      makeCase({ caseId: 'case-1', caseName: 'ccs', contextId: 'ctx-1', fieldNotes: 'Line one\nLine "two"', segmentStates: { l_femur: 'complete', r_femur: 'absent' } }),
      makeCase({ caseId: 'case-2', caseName: 'uwa_02', contextId: 'ctx-1', segmentStates: {} })
    ])

    await exportDatabaseCSV()
    expect(exported).toBeDefined()

    const text = await exported!.text()
    expect(text.split('\n')[0]).toBe('SPECIMENS')
    expect(text).toContain('\n\nINVENTORY\nBone,ccs,uwa_02\nl_femur,complete,\nr_femur,absent,')

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
      makeCase({ caseId: 'case-1', caseName: 'ccs', contextId: 'ctx-1', segmentStates: { r_ulna: 'complete' } }),
      makeCase({ caseId: 'case-2', caseName: 'ccs', contextId: 'ctx-2', segmentStates: { r_ulna: 'absent' } }),
      makeCase({ caseId: 'case-3', caseName: 'ccs', contextId: 'ctx-2', segmentStates: { r_ulna: 'fragmentary' } }),
      makeCase({ caseId: 'case-4', caseName: 'solo', contextId: 'ctx-1', segmentStates: {} })
    ])

    await exportDatabaseCSV()
    const text = await exported!.text()
    expect(text).toContain('Bone,ccs (Tell A / Layer 1),ccs (Tell A / Layer 2) [case-2],ccs (Tell A / Layer 2) [case-3],solo')

    const preview = await previewDatabaseCSV(exported!)
    expect(preview.cases).toEqual(await db.cases.toArray())
  })
})
