import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HardwareSection } from '../HardwareSection'

// Mocks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'pt-BR' } }),
}))

vi.mock('@/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({ symbol: 'R$', format: (v: number) => `R$ ${v.toFixed(2)}`, CURRENCIES: {} }),
}))

const mockSetFdmHardware = vi.fn()
const mockSetFdmFinishing = vi.fn()
const mockSetResinPostProcess = vi.fn()
const mockSetResinHardware = vi.fn()

interface MockStore {
  activeTab: string
  fdmHardware: {
    enabled: boolean
    nozzleEnabled: boolean
    nozzleCost: number
    nozzleLifespanKg: number
    bedEnabled: boolean
    bedAdhesionCost: number
  }
  fdmFinishing: { enabled: boolean; suppliesCost: number }
  resinPostProcess: {
    washingEnabled: boolean
    alcoholCostPerLiter: number
    alcoholVolumeLiters: number
    curingEnabled: boolean
    curingTimeMinutes: number
    curingPowerWatts: number
  }
  resinHardware: {
    enabled: boolean
    lcdCost: number
    lcdLifespanHours: number
    fepCost: number
    fepLifespanPrints: number
  }
  setFdmHardware: ReturnType<typeof vi.fn>
  setFdmFinishing: ReturnType<typeof vi.fn>
  setResinPostProcess: ReturnType<typeof vi.fn>
  setResinHardware: ReturnType<typeof vi.fn>
  [key: string]: unknown
}

let mockStore: MockStore

const createMockStore = (overrides: Partial<MockStore> = {}): MockStore => ({
  activeTab: 'fdm',
  fdmHardware: {
    enabled: true,
    nozzleEnabled: true,
    nozzleCost: 25,
    nozzleLifespanKg: 5,
    bedEnabled: true,
    bedAdhesionCost: 0.2,
  },
  fdmFinishing: { enabled: false, suppliesCost: 5 },
  resinPostProcess: {
    washingEnabled: true,
    alcoholCostPerLiter: 25,
    alcoholVolumeLiters: 0.1,
    curingEnabled: true,
    curingTimeMinutes: 10,
    curingPowerWatts: 36,
  },
  resinHardware: {
    enabled: true,
    lcdCost: 400,
    lcdLifespanHours: 2000,
    fepCost: 80,
    fepLifespanPrints: 50,
  },
  setFdmHardware: mockSetFdmHardware,
  setFdmFinishing: mockSetFdmFinishing,
  setResinPostProcess: mockSetResinPostProcess,
  setResinHardware: mockSetResinHardware,
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

describe('HardwareSection', () => {
  beforeEach(() => {
    mockStore = createMockStore()
    vi.clearAllMocks()
  })

  describe('renders basics', () => {
    it('renders without crashing', () => {
      render(<HardwareSection />)
      expect(screen.getByTestId('section-header')).toBeInTheDocument()
    })

    it('renders section header with FDM title when activeTab is fdm', () => {
      render(<HardwareSection />)
      expect(screen.getByTestId('section-header')).toHaveTextContent('calc.fdmHardware')
      expect(screen.getByTestId('section-subtitle')).toHaveTextContent('calc.sectionDesc.fdmHardware')
    })

    it('renders section header with resin subtitle when activeTab is resin', () => {
      mockStore = createMockStore({ activeTab: 'resin' })
      render(<HardwareSection />)
      expect(screen.getByTestId('section-subtitle')).toHaveTextContent('calc.sectionDesc.resinHardware')
    })
  })

  describe('FDM mode', () => {
    it('shows nozzle and bed sections in FDM mode', () => {
      render(<HardwareSection />)
      expect(screen.getByText('calc.nozzle')).toBeInTheDocument()
      expect(screen.getByText('calc.bed')).toBeInTheDocument()
      expect(screen.getByText('calc.fdmFinishing')).toBeInTheDocument()
    })

    it('shows nozzle cost and lifespan inputs when nozzle enabled', () => {
      render(<HardwareSection />)
      expect(screen.getByText('calc.nozzleCost')).toBeInTheDocument()
      expect(screen.getByText('calc.nozzleLife')).toBeInTheDocument()
      const spinbuttons = screen.getAllByRole('spinbutton')
      // nozzleCost, nozzleLife, bedCost, suppliesCost = 4 inputs
      expect(spinbuttons.length).toBeGreaterThanOrEqual(3)
    })

    it('hides nozzle inputs when nozzleEnabled is false', () => {
      mockStore = createMockStore({
        fdmHardware: { ...mockStore.fdmHardware, nozzleEnabled: false },
      })
      render(<HardwareSection />)
      expect(screen.queryByText('calc.nozzleCost')).not.toBeInTheDocument()
      expect(screen.queryByText('calc.nozzleLife')).not.toBeInTheDocument()
    })

    it('shows bed cost input when bed enabled', () => {
      render(<HardwareSection />)
      expect(screen.getByText('calc.bedCost')).toBeInTheDocument()
    })

    it('hides bed cost input when bedEnabled is false', () => {
      mockStore = createMockStore({
        fdmHardware: { ...mockStore.fdmHardware, bedEnabled: false },
      })
      render(<HardwareSection />)
      expect(screen.queryByText('calc.bedCost')).not.toBeInTheDocument()
    })

    it('shows finishing supplies input in FDM mode', () => {
      render(<HardwareSection />)
      expect(screen.getByText('calc.finishingSupplies')).toBeInTheDocument()
    })

    it('calls setFdmHardware when nozzle toggle is clicked', async () => {
      const user = userEvent.setup()
      render(<HardwareSection />)
      // Nozzle toggle is the first button in FDM mode
      const toggles = screen.getAllByRole('button')
      await user.click(toggles[0])
      expect(mockSetFdmHardware).toHaveBeenCalledWith({
        ...mockStore.fdmHardware,
        nozzleEnabled: false,
      })
    })

    it('calls setFdmHardware when bed toggle is clicked', async () => {
      const user = userEvent.setup()
      render(<HardwareSection />)
      // Bed toggle is the second button in FDM mode
      const toggles = screen.getAllByRole('button')
      await user.click(toggles[1])
      expect(mockSetFdmHardware).toHaveBeenCalledWith({
        ...mockStore.fdmHardware,
        bedEnabled: false,
      })
    })
  })

  describe('Resin mode', () => {
    beforeEach(() => {
      mockStore = createMockStore({ activeTab: 'resin' })
    })

    it('shows washing and curing sections in resin mode', () => {
      render(<HardwareSection />)
      expect(screen.getByText('calc.resinPostProcess')).toBeInTheDocument()
      expect(screen.getByText('calc.washing')).toBeInTheDocument()
      expect(screen.getByText('calc.curing')).toBeInTheDocument()
    })

    it('shows alcohol cost and volume inputs when washing enabled', () => {
      render(<HardwareSection />)
      expect(screen.getByText('calc.alcoholCost')).toBeInTheDocument()
      expect(screen.getByText('calc.alcoholVol')).toBeInTheDocument()
    })

    it('hides washing inputs when washingEnabled is false', () => {
      mockStore = createMockStore({
        activeTab: 'resin',
        resinPostProcess: { ...mockStore.resinPostProcess, washingEnabled: false },
      })
      render(<HardwareSection />)
      expect(screen.queryByText('calc.alcoholCost')).not.toBeInTheDocument()
      expect(screen.queryByText('calc.alcoholVol')).not.toBeInTheDocument()
    })

    it('shows curing time and power inputs when curing enabled', () => {
      render(<HardwareSection />)
      expect(screen.getByText('calc.cureTime')).toBeInTheDocument()
      expect(screen.getByText('calc.curePower')).toBeInTheDocument()
    })

    it('hides curing inputs when curingEnabled is false', () => {
      mockStore = createMockStore({
        activeTab: 'resin',
        resinPostProcess: { ...mockStore.resinPostProcess, curingEnabled: false },
      })
      render(<HardwareSection />)
      expect(screen.queryByText('calc.cureTime')).not.toBeInTheDocument()
      expect(screen.queryByText('calc.curePower')).not.toBeInTheDocument()
    })

    it('shows resin hardware inputs (LCD and FEP)', () => {
      render(<HardwareSection />)
      expect(screen.getByText('calc.resinHardware')).toBeInTheDocument()
      expect(screen.getByText('calc.lcdCost')).toBeInTheDocument()
      expect(screen.getByText('calc.lcdLife')).toBeInTheDocument()
      expect(screen.getByText('calc.fepCost')).toBeInTheDocument()
      expect(screen.getByText('calc.fepLife')).toBeInTheDocument()
    })

    it('calls setResinPostProcess when washing toggle clicked', async () => {
      const user = userEvent.setup()
      render(<HardwareSection />)
      // Washing toggle is the first button in resin mode
      const toggles = screen.getAllByRole('button')
      await user.click(toggles[0])
      expect(mockSetResinPostProcess).toHaveBeenCalledWith({
        ...mockStore.resinPostProcess,
        washingEnabled: false,
      })
    })

    it('calls setResinPostProcess when curing toggle clicked', async () => {
      const user = userEvent.setup()
      render(<HardwareSection />)
      // Curing toggle is the second button in resin mode
      const toggles = screen.getAllByRole('button')
      await user.click(toggles[1])
      expect(mockSetResinPostProcess).toHaveBeenCalledWith({
        ...mockStore.resinPostProcess,
        curingEnabled: false,
      })
    })
  })
})
