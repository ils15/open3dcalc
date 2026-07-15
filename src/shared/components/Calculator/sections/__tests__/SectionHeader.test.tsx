import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SectionHeader } from '../SectionHeader'
import { Wrench } from 'lucide-react'

const mockToggleField = vi.fn()
let mockCalcLevel = 'advanced'
let mockHiddenFields: string[] = []

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/shared/stores/calculatorStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useCalculatorStore: (selector?: any) => {
    const state = {
      calcLevel: mockCalcLevel,
      hiddenFields: mockHiddenFields,
      toggleField: mockToggleField,
    }
    return selector ? selector(state) : state
  },
}))

describe('SectionHeader', () => {
  beforeEach(() => {
    mockToggleField.mockClear()
    mockCalcLevel = 'advanced'
    mockHiddenFields = []
  })

  it('renders icon and title', () => {
    render(<SectionHeader Icon={Wrench} title="Test Title" />)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    // Icon renders via lucide-react
    const icon = document.querySelector('.lucide-wrench')
    expect(icon).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<SectionHeader Icon={Wrench} title="Title" subtitle="Subtitle text" />)
    expect(screen.getByText('Subtitle text')).toBeInTheDocument()
  })

  it('does not render subtitle when not provided', () => {
    render(<SectionHeader Icon={Wrench} title="Title" />)
    expect(screen.queryByText('Subtitle text')).not.toBeInTheDocument()
  })

  it('shows settings button when sectionId has intermediate fields and level is not basic', () => {
    render(<SectionHeader Icon={Wrench} title="Title" sectionId="sales" />)
    const settingsButton = screen.getByTitle('calc.customizeFields')
    expect(settingsButton).toBeInTheDocument()
  })

  it('hides settings button when level is basic', () => {
    mockCalcLevel = 'basic'
    render(<SectionHeader Icon={Wrench} title="Title" sectionId="sales" />)
    expect(screen.queryByTitle('calc.customizeFields')).not.toBeInTheDocument()
  })

  it('opens settings popover on click', () => {
    render(<SectionHeader Icon={Wrench} title="Title" sectionId="sales" />)
    const settingsButton = screen.getByTitle('calc.customizeFields')
    fireEvent.click(settingsButton)
    // Popover should show checkbox for intermediate fields
    expect(screen.getByText('calc.customizeFields')).toBeInTheDocument()
    // Should show field labels
    expect(screen.getByText('calc.infillPercent')).toBeInTheDocument()
    expect(screen.getByText('calc.extras')).toBeInTheDocument()
    expect(screen.getByText('calc.shipping')).toBeInTheDocument()
  })

  it('closes popover when clicking outside', () => {
    render(<SectionHeader Icon={Wrench} title="Title" sectionId="sales" />)
    // Open the popover
    fireEvent.click(screen.getByTitle('calc.customizeFields'))
    expect(screen.getByText('calc.shipping')).toBeInTheDocument()
    // Click outside
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('calc.shipping')).not.toBeInTheDocument()
  })

  it('calls toggleField when checkbox is toggled', () => {
    render(<SectionHeader Icon={Wrench} title="Title" sectionId="sales" />)
    // Open popover
    fireEvent.click(screen.getByTitle('calc.customizeFields'))
    // Click the checkbox inside the shipping label
    const label = screen.getByText('calc.shipping')
    const checkbox = label.querySelector('input[type="checkbox"]') as HTMLInputElement
    fireEvent.click(checkbox)
    expect(mockToggleField).toHaveBeenCalledWith('sales.shippingCost')
  })
})
