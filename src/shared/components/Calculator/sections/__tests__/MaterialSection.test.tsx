import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MaterialSection } from '../MaterialSection'
import type { CalculatorState } from '@/shared/stores/calculatorStore'

// Mock StlPreview so tests can drive the onClear wiring without 3D setup
vi.mock('@/shared/components/StlPreview/StlPreview', () => ({
	StlPreview: ({
		onClear,
		onFileParsed,
	}: {
		onClear?: () => void
		onFileParsed?: () => void
	}) => (
		<button type="button" data-testid="mock-stl-preview" onClick={onClear ?? onFileParsed}>
			mock stl preview
		</button>
	),
}))

const createMockStore = (overrides: Partial<CalculatorState> = {}): CalculatorState =>
	({
		fdmMaterial: {
			type: 'PLA',
			costPerKg: 80,
			weightUsed: 50,
			purgeWeight: 5,
			density: 1.24,
			spoolEfficiency: 95,
		},
		fdmPrintParams: {
			printTimeHours: 5,
			heatUpTimeMinutes: 10,
		},
		resinPrintParams: {
			printTimeHours: 0,
			heatUpTimeMinutes: 0,
		},
		setFdmPrintParams: vi.fn(),
		setResinPrintParams: vi.fn(),
		fdmAmsEnabled: false,
	fdmAmsSlots: [
		{
			materialType: 'PLA',
			costPerKg: 80,
			weightUsedGrams: 50,
			purgeWeightGrams: 5,
			transitionPurgeGrams: 3,
			density: 1.24,
			spoolEfficiency: 95,
			color: '#ff0000',
			enabled: true,
		},
		{
			materialType: 'PETG',
			costPerKg: 100,
			weightUsedGrams: 30,
			purgeWeightGrams: 3,
			transitionPurgeGrams: 3,
			density: 1.27,
			spoolEfficiency: 90,
			color: '#0000ff',
			enabled: false,
		},
	],
		resinMaterial: {
			type: 'Standard Resin',
			costPerLiter: 250,
			volumeUsedMl: 30,
			wasteMarginPercent: 10,
		},
		selectedPrinter: {
			id: 'printer-1',
			name: 'Test Printer',
			brand: 'Test',
			power: 200,
			value: 2000,
			usefulLife: 5000,
			maintenancePerHour: 10,
			maxFilaments: 4,
		},
		setFdmMaterial: vi.fn(),
		setResinMaterial: vi.fn(),
		setFdmAmsEnabled: vi.fn(),
		setFdmAmsSlot: vi.fn(),
		...overrides,
	}) as unknown as CalculatorState

const mockCatalogMaterials = [
	{ name: 'PLA', type: 'fdm' },
	{ name: 'PETG', type: 'fdm' },
	{ name: 'ABS', type: 'fdm' },
	{ name: 'Standard Resin', type: 'resin' },
	{ name: 'Water Washable', type: 'resin' },
]

const mockInventorySpools = [
	{ id: 'spool-1', brand: 'Bambu', material: 'PLA', color: 'White', colorHex: '#ffffff', weightGrams: 750, originalWeightGrams: 1000, costPerKg: 75, diameterMm: 1.75, dateAdded: Date.now(), notes: '', status: 'in_stock' as const, purchaseStore: '' },
	{ id: 'spool-2', brand: 'eSUN', material: 'PETG', color: 'Black', colorHex: '#000000', weightGrams: 900, originalWeightGrams: 1000, costPerKg: 90, diameterMm: 1.75, dateAdded: Date.now(), notes: '', status: 'in_stock' as const, purchaseStore: '' },
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
	showSpoolSelector: false,
	setShowSpoolSelector: vi.fn(),
	inventorySpools: mockInventorySpools,
	catalogMaterials: mockCatalogMaterials,
}

describe('MaterialSection', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('renders without crashing', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} />)
		expect(screen.getByTestId('section-header')).toBeInTheDocument()
	})

	it('displays the section title via renderSectionHeader', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} />)
		expect(screen.getByTestId('section-header')).toHaveTextContent('calc.material')
	})

	it('shows FDM material type select when isFDM is true', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={true} />)
		expect(screen.getByText('calc.filamentType')).toBeInTheDocument()
	})

	it('shows FDM cost per kg input when isFDM is true', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={true} />)
		expect(screen.getByText('calc.costPerKg')).toBeInTheDocument()
	})

	it('shows FDM weight input when isFDM is true', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={true} />)
		expect(screen.getByText('calc.weight')).toBeInTheDocument()
	})

	it('shows resin type select when isFDM is false', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={false} />)
		expect(screen.getByText('calc.resinType')).toBeInTheDocument()
	})

	it('shows resin cost per liter input when isFDM is false', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={false} />)
		expect(screen.getByText('calc.costPerLiter')).toBeInTheDocument()
	})

	it('shows resin volume input when isFDM is false', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={false} />)
		expect(screen.getByText('calc.volumeMl')).toBeInTheDocument()
	})

	it('shows purge weight input when isFieldVisible returns true for purgeWeight', () => {
		const store = createMockStore()
		render(
			<MaterialSection
				{...defaultProps}
				store={store}
				isFDM={true}
				isFieldVisible={vi.fn((_section: string, field: string) => field === 'purgeWeight')}
			/>,
		)
		expect(screen.getByText('calc.purge')).toBeInTheDocument()
	})

	it('hides purge weight input when isFieldVisible returns false', () => {
		const store = createMockStore()
		render(
			<MaterialSection
				{...defaultProps}
				store={store}
				isFDM={true}
				isFieldVisible={vi.fn(() => false)}
			/>,
		)
		expect(screen.queryByText('calc.purge')).not.toBeInTheDocument()
	})

	it('shows spool efficiency input when isFieldVisible returns true', () => {
		const store = createMockStore()
		render(
			<MaterialSection
				{...defaultProps}
				store={store}
				isFDM={true}
				isFieldVisible={vi.fn((_section: string, field: string) => field === 'spoolEfficiency')}
			/>,
		)
		expect(screen.getByText('calc.spoolEfficiency')).toBeInTheDocument()
	})

	it('shows density input when isFieldVisible returns true', () => {
		const store = createMockStore()
		render(
			<MaterialSection
				{...defaultProps}
				store={store}
				isFDM={true}
				isFieldVisible={vi.fn((_section: string, field: string) => field === 'density')}
			/>,
		)
		expect(screen.getByText('calc.density')).toBeInTheDocument()
	})

	it('shows waste margin input when isFieldVisible returns true for resin', () => {
		const store = createMockStore()
		render(
			<MaterialSection
				{...defaultProps}
				store={store}
				isFDM={false}
				isFieldVisible={vi.fn((_section: string, field: string) => field === 'wasteMargin')}
			/>,
		)
		expect(screen.getByText('calc.wasteMargin')).toBeInTheDocument()
	})

	it('hides waste margin input when isFieldVisible returns false', () => {
		const store = createMockStore()
		render(
			<MaterialSection
				{...defaultProps}
				store={store}
				isFDM={false}
				isFieldVisible={vi.fn(() => false)}
			/>,
		)
		expect(screen.queryByText('calc.wasteMargin')).not.toBeInTheDocument()
	})

	it('shows AMS toggle when printer has multiple filaments and purgeWeight is visible', () => {
		const store = createMockStore({
			selectedPrinter: { id: 'printer-1', name: 'Test Printer', brand: 'Test', power: 200, value: 2000, usefulLife: 5000, maintenancePerHour: 10, maxFilaments: 4 },
		})
		render(
			<MaterialSection
				{...defaultProps}
				store={store}
				isFDM={true}
				isFieldVisible={vi.fn((_section: string, field: string) => field === 'purgeWeight')}
			/>,
		)
		expect(screen.getByText('AMS Multi-material')).toBeInTheDocument()
	})

	it('hides AMS toggle when printer has only one filament', () => {
		const store = createMockStore({
			selectedPrinter: { id: 'printer-1', name: 'Test Printer', brand: 'Test', power: 200, value: 2000, usefulLife: 5000, maintenancePerHour: 10, maxFilaments: 1 },
		})
		render(
			<MaterialSection
				{...defaultProps}
				store={store}
				isFDM={true}
				isFieldVisible={vi.fn((_section: string, field: string) => field === 'purgeWeight')}
			/>,
		)
		expect(screen.queryByText('AMS Multi-material')).not.toBeInTheDocument()
	})

	it('hides AMS toggle when purgeWeight field is not visible', () => {
		const store = createMockStore({
			selectedPrinter: { id: 'printer-1', name: 'Test Printer', brand: 'Test', power: 200, value: 2000, usefulLife: 5000, maintenancePerHour: 10, maxFilaments: 4 },
		})
		render(
			<MaterialSection
				{...defaultProps}
				store={store}
				isFDM={true}
				isFieldVisible={vi.fn(() => false)}
			/>,
		)
		expect(screen.queryByText('AMS Multi-material')).not.toBeInTheDocument()
	})

	it('shows inventory button when spools are available', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={true} />)
		expect(screen.getByText('Inventário')).toBeInTheDocument()
	})

	it('hides inventory button when no spools are available', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={true} inventorySpools={[]} />)
		expect(screen.queryByText('Inventário')).not.toBeInTheDocument()
	})



	it('does not render resin inputs in FDM mode', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={true} />)
		expect(screen.queryByText('calc.resinType')).not.toBeInTheDocument()
		expect(screen.queryByText('calc.costPerLiter')).not.toBeInTheDocument()
		expect(screen.queryByText('calc.volumeMl')).not.toBeInTheDocument()
	})

	it('does not render FDM inputs in resin mode', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={false} />)
		expect(screen.queryByText('calc.filamentType')).not.toBeInTheDocument()
		expect(screen.queryByText('calc.costPerKg')).not.toBeInTheDocument()
		expect(screen.queryByText('calc.weight')).not.toBeInTheDocument()
	})

	it('uses FDM icon when isFDM is true', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={true} />)
		// renderSectionHeader is called with the icon, title, subtitle, and sectionId
		expect(defaultProps.renderSectionHeader).toHaveBeenCalledWith(
			expect.anything(),
			'calc.material',
			'calc.sectionDesc.fdmMaterial',
			'material',
		)
	})

	it('uses resin icon when isFDM is false', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={false} />)
		expect(defaultProps.renderSectionHeader).toHaveBeenCalledWith(
			expect.anything(),
			'calc.material',
			'calc.sectionDesc.resinMaterial',
			'material',
		)
	})

	it('renders without crashing with empty catalogMaterials', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} catalogMaterials={[]} />)
		expect(screen.getByTestId('section-header')).toBeInTheDocument()
	})

	it('renders without crashing with empty inventorySpools', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} inventorySpools={[]} />)
		expect(screen.getByTestId('section-header')).toBeInTheDocument()
	})

	it('all i18n keys render without missing key warnings', () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={true} />)
		// Check that no React warnings about missing keys were logged
		const missingKeyWarnings = consoleSpy.mock.calls.filter(
			(call) => typeof call[0] === 'string' && call[0].includes('key'),
		)
		expect(missingKeyWarnings).toHaveLength(0)
		consoleSpy.mockRestore()
	})

	it('onClear resets FDM print time and material weight', () => {
		const store = createMockStore()
		render(<MaterialSection {...defaultProps} store={store} isFDM={true} />)
		fireEvent.click(screen.getByTestId('mock-stl-preview'))
		expect(store.setFdmPrintParams).toHaveBeenCalledWith({
			...store.fdmPrintParams,
			printTimeHours: 0,
		})
		expect(store.setFdmMaterial).toHaveBeenCalledWith({
			...store.fdmMaterial,
			weightUsed: 0,
		})
	})

	it('onClear resets the active AMS slot weight when AMS is enabled', () => {
		const store = createMockStore({ fdmAmsEnabled: true })
		render(<MaterialSection {...defaultProps} store={store} isFDM={true} />)
		fireEvent.click(screen.getByTestId('mock-stl-preview'))
		expect(store.setFdmPrintParams).toHaveBeenCalledWith({
			...store.fdmPrintParams,
			printTimeHours: 0,
		})
		// Only the enabled slot (index 0) is reset
		expect(store.setFdmAmsSlot).toHaveBeenCalledWith(
			0,
			expect.objectContaining({ weightUsedGrams: 0 }),
		)
		expect(store.setFdmMaterial).not.toHaveBeenCalled()
	})

	it('places the STL preview inside the material grid so col-span applies', () => {
		const store = createMockStore()
		const { container } = render(<MaterialSection {...defaultProps} store={store} isFDM={true} />)
		const stl = container.querySelector('[data-testid="mock-stl-preview"]')
		expect(stl).not.toBeNull()
		// STL wrapper must be a grid child with col-span-2
		const wrapper = stl!.parentElement!
		expect(wrapper.className).toContain('@form:col-span-2')
		// The wrapper must live INSIDE the grid container
		const grid = wrapper.parentElement!
		expect(grid.className).toContain('grid grid-cols-1')
		expect(grid.className).toContain('@form:grid-cols-2')
	})

	it('keeps a full-width STL preview in AMS mode (no grid context)', () => {
		const store = createMockStore({ fdmAmsEnabled: true })
		const { container } = render(<MaterialSection {...defaultProps} store={store} isFDM={true} />)
		const stl = container.querySelector('[data-testid="mock-stl-preview"]')
		expect(stl).not.toBeNull()
		const wrapper = stl!.parentElement!
		expect(wrapper.className).toContain('mt-3')
		expect(wrapper.className).not.toContain('col-span-2')
	})
})
