import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TextInputPopup from './TextInputPopup'

function setup(initialValue = '') {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(
    <TextInputPopup
      isOpen
      title="New site"
      label="Site name"
      initialValue={initialValue}
      onSave={onSave}
      onCancel={onCancel}
    />,
  )
  return { onSave, onCancel, input: screen.getByLabelText('Site name') }
}

describe('TextInputPopup', () => {
  it('rejects a blank name', async () => {
    const { onSave } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('rejects a name that is only spaces', async () => {
    const { onSave, input } = setup()
    await userEvent.type(input, '     ')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('trims the name before saving', async () => {
    const { onSave, input } = setup()
    await userEvent.type(input, '   Tell A   ')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith('Tell A')
  })

  it('saves when Enter is pressed', async () => {
    const { onSave, input } = setup()
    await userEvent.type(input, ' Tell B {Enter}')
    expect(onSave).toHaveBeenCalledWith('Tell B')
  })

  it('does not save when Cancel is pressed', async () => {
    const { onSave, onCancel, input } = setup()
    await userEvent.type(input, 'Tell C')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not save when Escape is pressed', async () => {
    const { onSave, onCancel, input } = setup()
    await userEvent.type(input, 'Tell D{Escape}')
    expect(onCancel).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
