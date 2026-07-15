import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OpsSection } from '../OpsSection'

// Mock all hooks and sub-components
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'pt-BR' } }),
}))

vi.mock('@/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({ symbol: 'R$', format: (v: number) => `R$ ${v.toFixed(2)}`, CURRENCIES: {} }),
}))

const mockSetFdmOps = vi.fn()
const mockSetResinOps = vi.fn()
const mockSetFdmSoft = vi.fn()
const mockSetResinSoft = vi.fn()

interface MockStore {
  activeTab: string
  fdmOps: { enabled: boolean; ppeCostPerPrint: number }
  resinOps: { enabled: boolean; ppeCostPerPrint: number }
  fdmSoft: { enabled: boolean; slicerMonthlyCost: number; modelFileCost: number }
  resinSoft: { enabled: boolean; slicerMonthlyCost: number; modelFileCost: number }
  setFdmOps: ReturnType<typeof vi.fn>
  setResinOps: ReturnType<typeof vi.fn>
  setFdmSoft: ReturnType<typeof vi.fn>
  setResinSoft: ReturnType<typeof vi.fn>
  [key: string]: unknown
}

let mockStore: MockStore

const createMockStore = (overrides: Partial<MockStore> = {}): MockStore => ({
  activeTab: 'fdm',
  fdmOps: { enabled: false, ppeCostPerPrint: 0 },
  resinOps: { enabled: false, ppeCostPerPrint: 0 },
  fdmSoft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 },
  resinSoft: { enabled: false, slicerMonthlyCost: 0, modelFileCost: 0 },
  setFdmOps: mockSetFdmOps,
  setResinOps: mockSetResinOps,
  setFdmSoft: mockSetFdmSoft,
  setResinSoft: mockSetResinSoft,
  ...overrides,
})

vi.mock('@/shared/stores/calculatorStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useCalculatorStore: (selector?: any) => {
    return selector ? selector(mockStore) : mockStore
  },
}))

vi.mock('../SectionHeader', () => ({
  SectionHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="section-header">
      <div>{title}</div>
      {subtitle && <div data-testid="section-subtitle">{subtitle}</div>}
    </div>
  ),
}))

describe('OpsSection', () => {
  beforeEach(() => {
    mockStore = createMockStore()
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<OpsSection />)
    expect(screen.getByTestId('section-header')).toBeInTheDocument()
  })

  it('renders section header with ops title and subtitle', () => {
    render(<OpsSection />)
    expect(screen.getByTestId('section-header')).toHaveTextContent('calc.opsSoftware')
    expect(screen.getByTestId('section-subtitle')).toHaveTextContent('calc.sectionDesc.ops')
  })

  it('shows PPE and Software labels', () => {
    render(<OpsSection />)
    expect(screen.getByText('calc.ppe')).toBeInTheDocument()
    expect(screen.getByText('calc.software')).toBeInTheDocument()
  })

  it('shows two toggle switches (PPE and Software)', () => {
    render(<OpsSection />)
    const toggles = screen.getAllByRole('button')
    // 2 toggles (PPE + Software), no other buttons since SectionHeader is mocked
    expect(toggles).toHaveLength(2)
  })

  it('shows PPE cost input when PPE is enabled', () => {
    mockStore = createMockStore({ fdmOps: { enabled: true, ppeCostPerPrint: 5 } })
    render(<OpsSection />)
    expect(screen.getByText('calc.ppeCost')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('hides PPE cost input when PPE is disabled', () => {
    render(<OpsSection />)
    expect(screen.queryByText('calc.ppeCost')).not.toBeInTheDocument()
  })

  it('shows slicer and model cost inputs when Software is enabled', () => {
    mockStore = createMockStore({ fdmSoft: { enabled: true, slicerMonthlyCost: 30, modelFileCost: 10 } })
    render(<OpsSection />)
    expect(screen.getByText('calc.slicerCost')).toBeInTheDocument()
    expect(screen.getByText('calc.modelCost')).toBeInTheDocument()
    const spinbuttons = screen.getAllByRole('spinbutton')
    expect(spinbuttons).toHaveLength(2)
  })

  it('hides software inputs when Software is disabled', () => {
    render(<OpsSection />)
    expect(screen.queryByText('calc.slicerCost')).not.toBeInTheDocument()
    expect(screen.queryByText('calc.modelCost')).not.toBeInTheDocument()
  })

  it('shows resin PPE cost when activeTab is resin and PPE enabled', () => {
    mockStore = createMockStore({
      activeTab: 'resin',
      resinOps: { enabled: true, ppeCostPerPrint: 2.5 },
    })
    render(<OpsSection />)
    expect(screen.getByText('calc.ppeCost')).toBeInTheDocument()
  })

  it('calls setFdmOps when PPE toggle is clicked in FDM mode', async () => {
    const user = userEvent.setup()
    render(<OpsSection />)
    const toggles = screen.getAllByRole('button')
    // First toggle is PPE toggle
    await user.click(toggles[0])
    expect(mockSetFdmOps).toHaveBeenCalledWith({
      enabled: true,
      ppeCostPerPrint: 0,
    })
  })

  it('calls setFdmSoft when Software toggle is clicked in FDM mode', async () => {
    const user = userEvent.setup()
    render(<OpsSection />)
    const toggles = screen.getAllByRole('button')
    // Second toggle is Software toggle
    await user.click(toggles[1])
    expect(mockSetFdmSoft).toHaveBeenCalledWith({
      enabled: true,
      slicerMonthlyCost: 0,
      modelFileCost: 0,
    })
  })

  it('calls setResinOps when PPE toggle is clicked in Resin mode', async () => {
    mockStore = createMockStore({
      activeTab: 'resin',
      resinOps: { enabled: false, ppeCostPerPrint: 0 },
    })
    const user = userEvent.setup()
    render(<OpsSection />)
    const toggles = screen.getAllByRole('button')
    await user.click(toggles[0])
    expect(mockSetResinOps).toHaveBeenCalledWith({
      enabled: true,
      ppeCostPerPrint: 0,
    })
  })
})
