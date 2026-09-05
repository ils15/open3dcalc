import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductInventory } from '../ProductInventory'
import { useProductInventory } from '@/shared/stores/productInventory'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

beforeEach(() => {
  localStorage.clear()
  useProductInventory.setState({ products: [] })
  vi.restoreAllMocks()
})

describe('ProductInventory UI behavior', () => {
  it('renders empty state when no products exist', () => {
    render(<ProductInventory />)
    expect(screen.getByText('products.noProducts')).toBeInTheDocument()
  })

  it('adds a product through the form and shows it in the table', async () => {
    const user = userEvent.setup()
    render(<ProductInventory />)

    await user.click(screen.getByRole('button', { name: 'products.newProduct' }))
    await user.type(screen.getByLabelText('products.name'), 'Suporte Headset')
    await user.type(screen.getByLabelText('products.weight'), '85')
    await user.type(screen.getByLabelText('products.cost'), '12.5')
    await user.type(screen.getByLabelText('products.price'), '39.9')
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    expect(screen.getByText('Suporte Headset')).toBeInTheDocument()
    expect(useProductInventory.getState().products).toHaveLength(1)
  })

  it('warns (without blocking) when sale price is below cost', async () => {
    const user = userEvent.setup()
    render(<ProductInventory />)

    await user.click(screen.getByRole('button', { name: 'products.newProduct' }))
    await user.type(screen.getByLabelText('products.name'), 'Peça Barata')
    await user.type(screen.getByLabelText('products.cost'), '50')
    await user.type(screen.getByLabelText('products.price'), '10')

    // Warn appears live in the form…
    expect(await screen.findByText(/products\.belowCostWarn/)).toBeInTheDocument()

    // …but save is NOT blocked.
    await user.click(screen.getByRole('button', { name: 'common.save' }))
    expect(screen.getByText('Peça Barata')).toBeInTheDocument()
  })

  it('toggles sold status via checkbox', async () => {
    const user = userEvent.setup()
    useProductInventory.getState().addProduct({
      name: 'Vaso Espiral',
      weightGrams: 100,
      filamentType: 'PLA',
      costPrice: 8,
      salePrice: 29.9,
    })
    render(<ProductInventory />)

    const toggle = screen.getByRole('checkbox', { name: /products\.sold/ })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(toggle).toBeChecked()
    expect(useProductInventory.getState().products[0].sold).toBe(true)
  })

  it('filters by search text and sold status', async () => {
    const user = userEvent.setup()
    const api = useProductInventory.getState()
    const id = api.addProduct({
      name: 'Suporte Headset',
      weightGrams: 85,
      filamentType: 'PLA',
      costPrice: 12,
      salePrice: 39,
    })
    api.addProduct({
      name: 'Vaso Espiral',
      weightGrams: 100,
      filamentType: 'PETG',
      costPrice: 8,
      salePrice: 29,
    })
    useProductInventory.getState().markSold(id, true)
    render(<ProductInventory />)

    await user.type(screen.getByPlaceholderText('products.searchPlaceholder'), 'vaso')
    expect(screen.queryByText('Suporte Headset')).not.toBeInTheDocument()
    expect(screen.getByText('Vaso Espiral')).toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText('products.searchPlaceholder'))
    fireEvent.change(screen.getByLabelText('products.status'), { target: { value: 'sold' } })
    expect(screen.getByText('Suporte Headset')).toBeInTheDocument()
    expect(screen.queryByText('Vaso Espiral')).not.toBeInTheDocument()
  })

  it('exports CSV via Blob download', async () => {
    const user = userEvent.setup()
    useProductInventory.getState().addProduct({
      name: 'Suporte Headset',
      weightGrams: 85,
      filamentType: 'PLA',
      costPrice: 12.5,
      salePrice: 39.9,
    })
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    window.URL.createObjectURL = createObjectURL
    window.URL.revokeObjectURL = revokeObjectURL
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<ProductInventory />)
    await user.click(screen.getByRole('button', { name: 'products.exportCsv' }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    clickSpy.mockRestore()
  })
})
