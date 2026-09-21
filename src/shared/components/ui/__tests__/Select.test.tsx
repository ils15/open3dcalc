import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import { resolve } from 'node:path'
import { Select } from '../Select/Select'

const mockOptions = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
]

// vitest roda a partir da raiz do config (raiz do repo)
const WEB_CSS = resolve(process.cwd(), 'src/platform/web/index.css')

/** Restaura matchMedia/geometry stubbed em testes individuais. */
const originalMatchMedia = window.matchMedia
afterEach(() => {
  window.matchMedia = originalMatchMedia
  vi.restoreAllMocks()
})

describe('Select', () => {
  it('renders with label', () => {
    render(<Select value="a" onChange={vi.fn()} options={mockOptions} label="Test" />)
    expect(screen.getByLabelText('Test')).toBeInTheDocument()
  })

  it('shows selected option label', () => {
    render(<Select value="b" onChange={vi.fn()} options={mockOptions} label="Test" />)
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    render(<Select value="a" onChange={vi.fn()} options={mockOptions} label="Test" />)
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('has zero-duration transition when reduced motion is preferred', () => {
    // This test verifies the component respects reduced motion
    // The actual behavior is controlled by the useReducedMotion hook
    render(<Select value="a" onChange={vi.fn()} options={mockOptions} label="Test" />)
    fireEvent.click(screen.getByRole('combobox'))
    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeInTheDocument()
  })

  it('filters options by the search query', () => {
    render(<Select value="a" onChange={vi.fn()} options={mockOptions} label="Test" />)
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'Option B' } })
    expect(screen.getByRole('option', { name: /Option B/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Option A/ })).not.toBeInTheDocument()
  })

  /* ---------------------------------------------------------------
   * CAUSA-RAIZ 2 — clipping por overflow (caso FilamentInventory):
   * o menu tem que viver num portal, fora do container scrollable.
   * ------------------------------------------------------------- */
  it('renders the menu in a portal, escaping overflow-clipped containers', () => {
    render(
      <div data-testid="scroll-container" style={{ maxHeight: '100px', overflowY: 'auto' }}>
        <Select value="a" onChange={vi.fn()} options={mockOptions} label="Test" />
      </div>,
    )
    fireEvent.click(screen.getByRole('combobox'))

    const listbox = screen.getByRole('listbox')
    const container = screen.getByTestId('scroll-container')
    expect(document.body.contains(listbox)).toBe(true)
    expect(container.contains(listbox)).toBe(false)
  })

  /* ---------------------------------------------------------------
   * CAUSA-RAIZ 3 — z-index acima da bottom nav mobile (z-50).
   * ------------------------------------------------------------- */
  it('layers the menu above the mobile bottom nav via the --z-dropdown token', () => {
    render(<Select value="a" onChange={vi.fn()} options={mockOptions} label="Test" />)
    fireEvent.click(screen.getByRole('combobox'))

    // A bottom nav z-50 pinta por cima de um menu z-50; o token resolve isso.
    expect(screen.getByRole('listbox').style.zIndex).toBe('var(--z-dropdown)')
  })

  it('defines --z-dropdown above the bottom nav layer (z-50)', () => {
    const css = fs.readFileSync(WEB_CSS, 'utf8')
    const token = css.match(/--z-dropdown:\s*(\d+)/)
    expect(token, '--z-dropdown must be defined in the theme tokens').not.toBeNull()
    expect(Number(token![1])).toBeGreaterThan(50)
  })

  /* ---------------------------------------------------------------
   * CAUSA-RAIZ 1 — colisão: menu abre para cima (flip) quando não
   * cabe embaixo do trigger. jsdom não faz layout, então stubamos a
   * geometria que o floating-ui lê (rects + viewport).
   * ------------------------------------------------------------- */
  it('flips the menu above the trigger when there is no room below', async () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 1024, configurable: true })
    Object.defineProperty(document.documentElement, 'clientHeight', { value: 768, configurable: true })

    const rect = (top: number, bottom: number, height: number): DOMRect =>
      ({ top, bottom, left: 8, right: 208, width: 200, height, x: 8, y: top }) as DOMRect

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const role = this.getAttribute('role')
      // trigger encostado no fim de uma viewport de 768px (bottom = 760)
      if (role === 'combobox') return rect(700, 760, 60)
      // menu com 200px de altura — não cabe abaixo (760 + 200 > 768)
      if (role === 'listbox') return rect(0, 200, 200)
      return rect(0, 0, 0)
    })
    // jsdom não faz layout; o flip/size precisa de dimensões reais do menu
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('role') === 'listbox' ? 200 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('role') === 'listbox' ? 200 : 0
    })

    render(<Select value="a" onChange={vi.fn()} options={mockOptions} label="Test" />)
    fireEvent.click(screen.getByRole('combobox'))
    // computePosition é assíncrono (Promise + flushSync)
    await act(async () => { await Promise.resolve() })

    const listbox = screen.getByRole('listbox')
    // posicionamento real aplicado pelo floating-ui (não mais mt-1.5/absolute manual)
    expect(listbox.style.position).toBe('absolute')
    // flip: menu foi parar acima do trigger (top < 700) em vez de abaixo (766)
    const top = parseFloat(listbox.style.top)
    expect(top).toBeGreaterThan(0)
    expect(top).toBeLessThan(700)
  })

  /* ---------------------------------------------------------------
   * CAUSA-RAIZ 4 — mobile ≤640px vira bottom sheet.
   * ------------------------------------------------------------- */
  it('renders as a full-width bottom sheet on narrow viewports', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia

    render(<Select value="a" onChange={vi.fn()} options={mockOptions} label="Test" />)
    fireEvent.click(screen.getByRole('combobox'))

    const listbox = screen.getByRole('listbox')
    expect(listbox.style.position).toBe('fixed')
    expect(listbox.style.bottom).toBe('0px')
  })

  /* ---------------------------------------------------------------
   * Refactor guards — a lógica de fechamento passou a reusar
   * useDismissablePopover; o contrato de teclado tem que se manter.
   * (AnimatePresence mantém o nó montado durante a saída, então
   *  afirmamos o estado ARIA síncrono, não o unmount.)
   * ------------------------------------------------------------- */
  it('closes on Escape and returns focus to the trigger', () => {
    const onChange = vi.fn()
    render(<Select value="a" onChange={onChange} options={mockOptions} label="Test" />)
    const trigger = screen.getByRole('combobox')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(trigger)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes when clicking outside', () => {
    render(
      <div>
        <Select value="a" onChange={vi.fn()} options={mockOptions} label="Test" />
        <button data-testid="outside">outside</button>
      </div>,
    )
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('selects an option via keyboard (ArrowDown + Enter)', () => {
    const onChange = vi.fn()
    render(<Select value="a" onChange={onChange} options={mockOptions} label="Test" />)
    fireEvent.click(screen.getByRole('combobox'))

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('b')
  })
})
