import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SkeletonPage from './SkeletonPage'
import { createCase, getCase } from '../db/caseOperation'

async function createTestCase(name: string): Promise<string> {
  const created = await createCase('test-context', {
    caseName: name,
    sex: 'unknown',        // adjust to a valid value from your types.ts
    ageGroup: 'adult',     // adjust to a valid value from your types.ts
  })
  return created.caseId
}
// Pan/zoom isn't under test, and it pokes at layout APIs jsdom doesn't have.
vi.mock('@panzoom/panzoom', () => ({
  default: () => ({ destroy() {}, reset() {}, zoomWithWheel() {} }),
}))

const CASE_NAME = 'Undo Test Specimen'
let caseId: string



// Scoped to the front layer: the back drawing reuses some of the same ids.
const bone = (c: HTMLElement, id: string) => c.querySelector(`.skeleton-front-layer #${id}`)
const paintOf = (c: HTMLElement, id: string) => bone(c, id)?.getAttribute('data-paint') ?? null

// The click handler needs a shape inside the bone group as its target.
function clickBone(c: HTMLElement, id: string) {
  const shape = bone(c, id)?.querySelector('path')
  if (!shape) throw new Error(`No path found inside #${id}`)
  fireEvent.click(shape)
}

const undoButton = () => screen.getByRole('button', { name: 'Undo' })
const redoButton = () => screen.getByRole('button', { name: 'Redo' })

async function setup() {
  const view = render(<SkeletonPage caseId={caseId} onNavigate={vi.fn()} />)
  // Wait for the case name, not the "Tap a bone" hint: the hint shows before
  // the case loads, and clicking early would race the saved-state restore.
  await screen.findByText(CASE_NAME)
  return view.container
}

describe('SkeletonPage undo/redo (through the UI)', () => {
  beforeEach(async () => {
    caseId = await createTestCase(CASE_NAME)
  })

  it('Undo with nothing painted does nothing', async () => {
    await setup()
    expect(undoButton()).toBeDisabled()
    expect(redoButton()).toBeDisabled()
  })

  it('Undo then Redo gets back the same state', async () => {
    const c = await setup()

    clickBone(c, 'l_femur')
    await waitFor(() => expect(paintOf(c, 'l_femur')).toBe('present'))

    fireEvent.click(undoButton())
    await waitFor(() => expect(paintOf(c, 'l_femur')).toBeNull())

    fireEvent.click(redoButton())
    await waitFor(() => expect(paintOf(c, 'l_femur')).toBe('present'))

    // Same state in the database, not just on screen.
    await waitFor(async () => {
      expect((await getCase(caseId))?.segmentStates).toEqual({ l_femur: 'complete' })
    })
  })

  it('Undo only removes the most recent change', async () => {
    const c = await setup()

    clickBone(c, 'l_femur')
    clickBone(c, 'r_femur')
    await waitFor(() => expect(paintOf(c, 'r_femur')).toBe('present'))

    fireEvent.click(undoButton())
    await waitFor(() => expect(paintOf(c, 'r_femur')).toBeNull())
    expect(paintOf(c, 'l_femur')).toBe('present')
  })

  it('painting after an Undo clears Redo', async () => {
    const c = await setup()

    clickBone(c, 'l_femur')
    fireEvent.click(undoButton())
    await waitFor(() => expect(redoButton()).toBeEnabled()) // proves the next assertion isn't vacuous

    clickBone(c, 'r_femur')
    await waitFor(() => expect(paintOf(c, 'r_femur')).toBe('present'))
    expect(redoButton()).toBeDisabled()
  })
})