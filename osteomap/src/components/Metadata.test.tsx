import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Metadata from './Metadata'

function setup() {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(
    <Metadata
      isOpen
      caseName="SK-001"
      initialMetadata={{ sex: 'female', ageGroup: 'child', fieldNotes: 'Old notes' }}
      onSave={onSave}
      onCancel={onCancel}
    />,
  )
  return { onSave, onCancel }
}

describe('Metadata form', () => {
  it('starts with the values the specimen already has', () => {
    setup()
    expect(screen.getByLabelText('Specimen sex')).toHaveValue('female')
    expect(screen.getByLabelText('Specimen age group')).toHaveValue('child')
    expect(screen.getByLabelText('Specimen field notes')).toHaveValue('Old notes')
  })

  it('saves the changed values', async () => {
    const { onSave } = setup()
    await userEvent.selectOptions(screen.getByLabelText('Specimen sex'), 'male')
    await userEvent.selectOptions(screen.getByLabelText('Specimen age group'), 'adult')
    await userEvent.clear(screen.getByLabelText('Specimen field notes'))
    await userEvent.type(screen.getByLabelText('Specimen field notes'), 'New notes')
    await userEvent.click(screen.getByRole('button', { name: 'Save metadata' }))
    expect(onSave).toHaveBeenCalledWith({ sex: 'male', ageGroup: 'adult', fieldNotes: 'New notes' })
  })

  it('changes nothing when Cancel is pressed', async () => {
    const { onSave, onCancel } = setup()
    await userEvent.selectOptions(screen.getByLabelText('Specimen sex'), 'male')
    await userEvent.type(screen.getByLabelText('Specimen field notes'), ' more')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('changes nothing when the close button is pressed', async () => {
    const { onSave, onCancel } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Close specimen metadata' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
