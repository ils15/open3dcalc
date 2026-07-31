import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrintSection } from '../PrintSection'
import type { CalculatorState } from '@/shared/stores/calculatorStore'

const createMockStore = (overrides: Partial<CalculatorState> = {}): CalculatorState =>
	({
		fdmPrintParams: {
			printTimeHours: 2,
			printerPowerWatts: 200,
			energyCostPerKwh: 0.12,
			failureMode: 'percent',
			failureValue: 10,
			riskMultiplier: 1.5,
		},
		resinPrintParams: {
			printTimeHours: 3,
			printerPowerWatts: 100,
			energyCostPerKwh: 0.12,
			failureMode: 'none',
			failureValue: 0,
			riskMultiplier: 1,
		},
		selectedPrinter: {
			id: 'printer-1',
			name: 'Test Printer',
			power: 200,
			value: 2000,
		},
		setFdmPrintParams: vi.fn(),
		setResinPrintParams: vi.fn(),
		...overrides,
	}) as unknown as CalculatorState

const mockCatalogPrinters = [
	{ id: 'printer-1', name: 'Test Printer', power: 200, value: 2000, brand: 'Bambu' },
]

const defaultProps = {
	renderSectionHeader: vi.fn((_Icon, title) => (
		<div data-testid="section-header">{title}</div>
	)),
	t: (key: string) => key,
	currencySymbol: 'R$',
	handleInput: vi.fn(),
	isFDM: true,
	isFieldVisible: vi.fn(() => true),
	handlePrinterSelect: vi.fn(),
	catalogPrinters: mockCatalogPrinters,
}

describe('PrintSection', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('renders without crashing', () => {
		const store = createMockStore()
		render(<PrintSection {...defaultProps} store={store} />)
		expect(screen.getByTestId('section-header')).toBeInTheDocument()
	})

	it('displays the section title via renderSectionHeader', () => {
		const store = createMockStore()
		render(<PrintSection {...defaultProps} store={store} />)
		expect(screen.getByTestId('section-header')).toHaveTextContent('calc.printParams')
	})

	it('shows three input fields (print time, power, energy cost)', () => {
		const store = createMockStore()
		render(<PrintSection {...defaultProps} store={store} />)
		const inputs = screen.getAllByRole('spinbutton')
		expect(inputs.length).toBe(3)
	})

	it('displays FDM print values when isFDM is true', () => {
		const store = createMockStore({
			fdmPrintParams: {
				printTimeHours: 2.5,
				printerPowerWatts: 250,
				energyCostPerKwh: 0.15,
				failureMode: 'percent',
				failureValue: 10,
				riskMultiplier: 1.5,
				heatUpTimeMinutes: 5,
				heatUpPowerPercent: 150,
			},
		})
		render(<PrintSection {...defaultProps} isFDM={true} store={store} />)
		const inputs = screen.getAllByRole('spinbutton')
		expect(inputs[0]).toHaveValue(2.5)
		expect(inputs[1]).toHaveValue(250)
		expect(inputs[2]).toHaveValue(0.15)
	})

	it('displays resin print values when isFDM is false', () => {
		const store = createMockStore({
			resinPrintParams: {
				printTimeHours: 3.5,
				printerPowerWatts: 120,
				energyCostPerKwh: 0.10,
				failureMode: 'none',
				failureValue: 0,
				riskMultiplier: 1,
				heatUpTimeMinutes: 5,
				heatUpPowerPercent: 150,
			},
		})
		render(<PrintSection {...defaultProps} isFDM={false} store={store} />)
		const inputs = screen.getAllByRole('spinbutton')
		expect(inputs[0]).toHaveValue(3.5)
		expect(inputs[1]).toHaveValue(120)
		expect(inputs[2]).toHaveValue(0.10)
	})

	it('shows printer select when FDM and field is visible', () => {
		const store = createMockStore()
		render(<PrintSection {...defaultProps} store={store} isFDM={true} isFieldVisible={vi.fn(() => true)} />)
		expect(screen.getByText('calc.printer')).toBeInTheDocument()
	})

	it('hides printer select when field is not visible', () => {
		const store = createMockStore()
		render(<PrintSection {...defaultProps} store={store} isFDM={true} isFieldVisible={vi.fn(() => false)} />)
		expect(screen.queryByText('calc.printer')).not.toBeInTheDocument()
	})
})
