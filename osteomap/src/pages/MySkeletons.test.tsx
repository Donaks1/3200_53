import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../db/db'
import MySkeletons from './MySkeletons'

describe('My Skeletons editing', () => {
  it('saves edited metadata and leaves it unchanged when a later edit is cancelled', async () => {
    await db.sites.add({ siteId: 'site-1', siteName: 'Test Site' })
    await db.contexts.add({ contextId: 'context-1', contextName: 'Test Context', siteId: 'site-1' })
    await db.cases.add({
      caseId: 'case-1',
      caseName: 'SK-001',
      contextId: 'context-1',
      dateCreated: '2026-01-01T00:00:00.000Z',
      dateModified: '2026-01-01T00:00:00.000Z',
      fieldNotes: 'Original notes',
      sex: 'unknown',
      ageGroup: 'adult',
      segmentStates: {},
    })

    const user = userEvent.setup()
    render(<MySkeletons onNavigate={vi.fn()} />)

    expect(await screen.findByRole('heading', { name: 'SK-001' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Edit skeleton' }))
    expect(screen.getByRole('textbox', { name: 'Skeleton ID' })).toHaveValue('SK-001')
    expect(screen.getByRole('combobox', { name: 'Sex' })).toHaveValue('unknown')
    expect(screen.getByRole('combobox', { name: 'Age group' })).toHaveValue('adult')
    expect(screen.getByRole('textbox', { name: 'General notes' })).toHaveValue('Original notes')

    await user.clear(screen.getByRole('textbox', { name: 'Skeleton ID' }))
    await user.type(screen.getByRole('textbox', { name: 'Skeleton ID' }), 'SK-002')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sex' }), 'female')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Age group' }), 'adolescent')
    await user.clear(screen.getByRole('textbox', { name: 'General notes' }))
    await user.type(screen.getByRole('textbox', { name: 'General notes' }), 'Updated notes')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('heading', { name: 'SK-002' })).toBeVisible()
    expect(screen.getByText('Updated notes', { exact: false })).toBeVisible()
    await waitFor(async () => {
      expect(await db.cases.get('case-1')).toMatchObject({
        caseName: 'SK-002', sex: 'female', ageGroup: 'adolescent', fieldNotes: 'Updated notes',
      })
    })

    await user.click(screen.getByRole('button', { name: 'Edit skeleton' }))
    await user.clear(screen.getByRole('textbox', { name: 'Skeleton ID' }))
    await user.type(screen.getByRole('textbox', { name: 'Skeleton ID' }), 'Cancelled name')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sex' }), 'male')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Age group' }), 'infant')
    await user.clear(screen.getByRole('textbox', { name: 'General notes' }))
    await user.type(screen.getByRole('textbox', { name: 'General notes' }), 'Cancelled notes')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('heading', { name: 'Edit skeleton' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'SK-002' })).toBeVisible()
    expect(await db.cases.get('case-1')).toMatchObject({
      caseName: 'SK-002', sex: 'female', ageGroup: 'adolescent', fieldNotes: 'Updated notes',
    })
  }, 20000)
})
