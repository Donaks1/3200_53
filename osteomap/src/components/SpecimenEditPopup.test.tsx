import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpecimenEditPopup from './SpecimenEditPopup'

const specimen = { caseName: 'SK-001', sex: 'unknown', ageGroup: 'adult', fieldNotes: '' }

function renderPopup(props: Partial<Parameters<typeof SpecimenEditPopup>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(
    <SpecimenEditPopup
      title="Edit specimen"
      idLabel="Specimen ID"
      specimen={specimen}
      nameTaken={(name) => name.toLowerCase() === 'sk-002'}
      onSave={onSave}
      onCancel={vi.fn()}
      {...props}
    />,
  )
  return { onSave, user: userEvent.setup() }
}

describe('SpecimenEditPopup', () => {
  it('refuses an ID another specimen in the context already has', async () => {
    const { onSave, user } = renderPopup()
    const id = screen.getByRole('textbox', { name: 'Specimen ID' })

    await user.clear(id)
    await user.type(id, 'sk-002')

    expect(screen.getByText('A specimen called "sk-002" already exists in this context.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('lets a specimen keep its own ID, in different capitals', async () => {
    const { onSave, user } = renderPopup({ nameTaken: () => true })
    const id = screen.getByRole('textbox', { name: 'Specimen ID' })

    await user.clear(id)
    await user.type(id, ' sk-001 ')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledWith({ caseName: 'sk-001', sex: 'unknown', ageGroup: 'adult', fieldNotes: '' })
  })

  it('keeps stored values it does not recognise instead of replacing them', async () => {
    const { onSave, user } = renderPopup({ specimen: { caseName: 'SK-001', sex: 'M', ageGroup: null, fieldNotes: null } })

    expect(screen.getByRole('combobox', { name: 'Sex' })).toHaveValue('M')
    expect(screen.getByRole('combobox', { name: 'Age group' })).toHaveDisplayValue('Not recorded')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledWith({ caseName: 'SK-001', sex: 'M', fieldNotes: '' })
  })

  it('stays open and says so when the change could not be saved', async () => {
    const { user } = renderPopup({ onSave: vi.fn().mockRejectedValue(new Error('disk failure')) })

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("The change couldn't be saved on this device.")
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })

  it('does not let a blank ID be saved', async () => {
    const { onSave, user } = renderPopup()
    const id = screen.getByRole('textbox', { name: 'Specimen ID' })

    await user.clear(id)
    await user.type(id, '    ')

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('trims spaces around a new ID before saving', async () => {
    const { onSave, user } = renderPopup()
    const id = screen.getByRole('textbox', { name: 'Specimen ID' })

    await user.clear(id)
    await user.type(id, '   SK-009  ')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledWith({ caseName: 'SK-009', sex: 'unknown', ageGroup: 'adult', fieldNotes: '' })
  })

  it('changes nothing when Cancel is pressed', async () => {
    const onCancel = vi.fn()
    const { onSave, user } = renderPopup({ onCancel })

    await user.type(screen.getByRole('textbox', { name: 'Specimen ID' }), '-edited')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
