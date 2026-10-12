import { describe, expect, it } from 'vitest'
import { paintDrawing } from './exportPdf'
import { leftFoot, skeletonFront } from '../pages/skeletonDrawings'

const shapeStyle = (markup: string, id: string) => {
  const svg = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const shape = svg.getElementById(id)?.querySelector('path, polygon, circle, ellipse')
  return shape?.getAttribute('style') ?? ''
}

describe('paintDrawing', () => {
  it('writes each mark’s colour onto its shapes and greys out the rest', () => {
    const { markup, marked } = paintDrawing(skeletonFront, { left_femur: 'absent', right_femur: 'complete' })

    expect(marked).toBe(true)
    expect(shapeStyle(markup, 'left_femur')).toContain('fill:#f87171')
    expect(shapeStyle(markup, 'right_femur')).toContain('fill:#34d399')
    expect(shapeStyle(markup, 'left_humerus')).toContain('fill:#e2e8f0')
  })

  it('reports a drawing with nothing of the record on it as unmarked', () => {
    expect(paintDrawing(leftFoot, { left_femur: 'absent' }).marked).toBe(false)
    expect(paintDrawing(leftFoot, { left_foot: 'fragmentary' }).marked).toBe(true)
  })
})
