import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../db/db'
import ExportPage from './ExportPage'

describe('ExportPage', () => {
  it('opened without a specimen, offers only the full backup (no PDF) and goes back where it came from', async () => {
    const onNavigate = vi.fn()
    render(<ExportPage caseId={null} returnTo="home" onNavigate={onNavigate} />)

    expect(screen.queryByText('Active Case Data')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Export This Case/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export Full Backup/ })).toBeVisible()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Back' }))
    expect(onNavigate).toHaveBeenCalledWith('home', undefined)
  })

  it('opened for a specimen, shows it and goes back to the page it was opened from', async () => {
    await db.sites.add({ siteId: 'site-1', siteName: 'Tell A' })
    await db.contexts.add({ contextId: 'ctx-1', contextName: 'Layer 1', siteId: 'site-1' })
    await db.cases.add({
      caseId: 'case-1', caseName: 'SK-001', contextId: 'ctx-1', dateCreated: '', dateModified: '',
      fieldNotes: '', sex: 'unknown', ageGroup: 'adult', segmentStates: { left_femur: 'complete' },
    })
    const onNavigate = vi.fn()
    render(<ExportPage caseId="case-1" returnTo="my-skeletons" onNavigate={onNavigate} />)

    expect(await screen.findByText('SK-001')).toBeVisible()
    expect(screen.getByRole('button', { name: /Export This Case \(\.csv\)/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Export This Case \(\.pdf\)/ })).toBeEnabled()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Back' }))
    expect(onNavigate).toHaveBeenCalledWith('my-skeletons', 'case-1')
  })
})
