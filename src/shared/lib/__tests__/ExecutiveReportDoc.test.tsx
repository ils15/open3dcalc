import { describe, it, expect } from 'vitest'

// ExecutiveReportDoc uses @react-pdf/renderer which needs special handling
// For now, test that the module exports correctly
describe('ExecutiveReportDoc', () => {
  it('module exports correctly', async () => {
    const mod = await import('../ExecutiveReportDoc')
    expect(mod.ExecutiveReportDoc).toBeDefined()
    expect(typeof mod.ExecutiveReportDoc).toBe('function')
  })

  it('pdfExport exports executive function', async () => {
    const mod = await import('../pdfExport')
    expect(mod.exportExecutivePdf).toBeDefined()
    expect(typeof mod.exportExecutivePdf).toBe('function')
  })
})
