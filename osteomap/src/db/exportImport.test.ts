import { describe, expect, it } from 'vitest'
import { db } from './db'
import { applyImport, findImportConflicts, previewDatabaseCSV } from './exportImport'
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

function csvBlob(rows: string[]): Blob {
  const header = 'siteId,siteName,contextId,contextName,caseId,caseName,dateCreated,dateModified,fieldNotes,sex,ageGroup,segmentId,segmentState'
  return new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
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
      'site-import,Tell A,ctx-import,Layer 1,existing-id,Imported by ID,2026-01-02T00:00:00.000Z,2026-01-02T00:00:00.000Z,,,adult,,',
      'site-import,Tell A,ctx-import,Layer 1,new-id-1,Name Conflict,2026-01-03T00:00:00.000Z,2026-01-03T00:00:00.000Z,,,adult,,',
      'site-import,Tell A,ctx-import,Layer 1,new-id-2,Fresh Specimen,2026-01-03T00:00:00.000Z,2026-01-03T00:00:00.000Z,,,adult,,'
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
      'site-import,Tell A,ctx-import,Layer 1,existing-id,Imported by ID,2026-01-02T00:00:00.000Z,2026-01-02T00:00:00.000Z,,,adult,,'
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
