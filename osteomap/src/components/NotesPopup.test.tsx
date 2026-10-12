import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotesPopup from './NotesPopup'

describe('NotesPopup', () => {
  it('shows the existing notes', () => {
    render(<NotesPopup isOpen initialValue="Old notes" onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByLabelText('Skeleton notes')).toHaveValue('Old notes')
  })

  it('saves the new text when Save is pressed', async () => {
    const onSave = vi.fn()
    render(<NotesPopup isOpen initialValue="" onSave={onSave} onCancel={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Skeleton notes'), 'Left femur broken')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith('Left femur broken')
  })

  it('does not save when Escape is pressed', async () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<NotesPopup isOpen initialValue="" onSave={onSave} onCancel={onCancel} />)
    await userEvent.type(screen.getByLabelText('Skeleton notes'), 'abc{Escape}')
    expect(onCancel).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not save when Cancel is pressed', async () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<NotesPopup isOpen initialValue="Old notes" onSave={onSave} onCancel={onCancel} />)
    await userEvent.type(screen.getByLabelText('Skeleton notes'), ' extra')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
