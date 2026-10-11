import { describe, expect, it } from 'vitest'
import { db } from './db'
import { createSite, updateSite } from './siteOperation'
import { createContext, updateContext } from './contextOperation'
import { createCase, updateCaseMetadata } from './caseOperation'
import { DuplicateNameError } from './names'
import type { CaseRecord } from './types'

const specimen = (caseName: string) => ({ caseName, sex: 'unknown', ageGroup: 'adult' as const })

const storedCase = (caseId: string, caseName: string): CaseRecord => ({
  caseId,
  caseName,
  contextId: 'ctx-1',
  dateCreated: '2026-01-01T00:00:00.000Z',
  dateModified: '2026-01-01T00:00:00.000Z',
  fieldNotes: '',
  sex: 'unknown',
  ageGroup: 'adult',
  segmentStates: {},
})

describe('unique names', () => {
  it('refuses a second site with the same name, ignoring capitals and surrounding spaces', async () => {
    await createSite('Tell A')
    await expect(createSite(' tell a ')).rejects.toThrow('A site called "tell a" already exists.')
    expect(await db.sites.count()).toBe(1)
  })

  it('allows a context name in two sites, but not twice in one', async () => {
    const tellA = await createSite('Tell A')
    const tellB = await createSite('Tell B')
    await createContext('Layer 1', tellA.siteId)
    await createContext('Layer 1', tellB.siteId)
    await expect(createContext('LAYER 1', tellA.siteId)).rejects.toThrow('A context called "LAYER 1" already exists in this site.')
  })

  it('allows a specimen ID in two contexts, but not twice in one', async () => {
    await createCase('ctx-1', specimen('SK-001'))
    await createCase('ctx-2', specimen('SK-001'))
    await expect(createCase('ctx-1', specimen('sk-001'))).rejects.toBeInstanceOf(DuplicateNameError)
    expect(await db.cases.where('contextId').equals('ctx-1').count()).toBe(1)
  })

  it('refuses a rename onto a name already used alongside it, and leaves the record as it was', async () => {
    const tellA = await createSite('Tell A')
    const tellB = await createSite('Tell B')
    await expect(updateSite(tellB.siteId, 'Tell A')).rejects.toBeInstanceOf(DuplicateNameError)
    expect((await db.sites.get(tellB.siteId))?.siteName).toBe('Tell B')

    const layer1 = await createContext('Layer 1', tellA.siteId)
    const layer2 = await createContext('Layer 2', tellA.siteId)
    await expect(updateContext(layer2.contextId, 'layer 1')).rejects.toBeInstanceOf(DuplicateNameError)
    expect((await db.contexts.get(layer2.contextId))?.contextName).toBe('Layer 2')

    await createCase(layer1.contextId, specimen('SK-001'))
    const second = await createCase(layer1.contextId, specimen('SK-002'))
    await expect(updateCaseMetadata(second.caseId, { caseName: 'SK-001', sex: 'male' })).rejects.toBeInstanceOf(DuplicateNameError)
    expect(await db.cases.get(second.caseId)).toMatchObject({ caseName: 'SK-002', sex: 'unknown' })
  })

  it('lets specimens that already share a name be edited, and renamed in capitals only', async () => {
    await db.cases.bulkAdd([storedCase('case-a', 'SK-001'), storedCase('case-b', 'SK-001')])

    await updateCaseMetadata('case-a', { caseName: 'SK-001', sex: 'female' })
    await updateCaseMetadata('case-b', { caseName: 'sk-001' })

    expect(await db.cases.get('case-a')).toMatchObject({ caseName: 'SK-001', sex: 'female' })
    expect(await db.cases.get('case-b')).toMatchObject({ caseName: 'sk-001' })
  })

  it('stores names without the spaces around them, and refuses blank ones', async () => {
    expect((await createSite('  Tell A  ')).siteName).toBe('Tell A')
    await expect(createSite('   ')).rejects.toThrow('A site needs a name.')
    await expect(createCase('ctx-1', specimen(' '))).rejects.toThrow('A specimen needs an ID.')
  })
})
