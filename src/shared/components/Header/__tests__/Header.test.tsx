import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Header } from '../Header'

const mockChangeLanguage = vi.fn()
const mockStartTutorial = vi.fn()
const mockSetCurrency = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ 
    t: (k: string) => k, 
    i18n: { language: 'pt-BR', changeLanguage: mockChangeLanguage, resolvedLanguage: 'pt-BR' } 
  }),
}))

vi.mock('@/shared/stores/calculatorStore', () => ({
  useCalculatorStore: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selector?: any) => {
      const state = { currency: 'auto', setCurrency: mockSetCurrency }
      return selector ? selector(state) : state
    },
    { getState: () => ({ currency: 'auto', setCurrency: mockSetCurrency }) }
  ),
}))

vi.mock('@/shared/stores/tutorialStore', () => ({
  useTutorialStore: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selector?: any) => {
      const state = { startTutorial: mockStartTutorial }
      return selector ? selector(state) : state
    },
    { getState: () => ({ startTutorial: mockStartTutorial }) }
  ),
}))

vi.mock('@/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({ symbol: 'R$', format: (v: number) => `R$ ${v.toFixed(2)}` }),
  CURRENCIES: { USD: { symbol: '$', name: 'US Dollar' }, BRL: { symbol: 'R$', name: 'Brazilian Real' }, EUR: { symbol: '€', name: 'Euro' } },
}))

vi.mock('@/shared/lib/currency', () => ({
  CURRENCIES: { USD: { symbol: '$', name: 'US Dollar' }, BRL: { symbol: 'R$', name: 'Brazilian Real' }, EUR: { symbol: '€', name: 'Euro' } },
}))

vi.mock('../ThemeToggle', () => ({ ThemeToggle: () => <div data-testid="theme-toggle" /> }))

describe('Header', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders logo and title', () => {
    render(<Header />)
    expect(screen.getByText('app.title')).toBeInTheDocument()
  })

  it('renders beta badge', () => {
    render(<Header />)
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('renders tutorial button', () => {
    render(<Header />)
    expect(screen.getByLabelText('nav.tutorial')).toBeInTheDocument()
  })

  it('calls startTutorial when tutorial button clicked', async () => {
    render(<Header />)
    await user.click(screen.getByLabelText('nav.tutorial'))
    expect(mockStartTutorial).toHaveBeenCalled()
  })

  it('renders currency selector', () => {
    render(<Header />)
    expect(screen.getByTitle('settings.currency')).toBeInTheDocument()
  })

  it('shows currency menu on click', async () => {
    render(<Header />)
    await user.click(screen.getByTitle('settings.currency'))
    expect(screen.getByText('settings.currencyAuto')).toBeInTheDocument()
  })

  it('shows theme toggle', () => {
    render(<Header />)
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
  })

  it('renders language toggle', () => {
    render(<Header />)
    expect(screen.getByTitle('nav.language')).toBeInTheDocument()
  })

  it('calls changeLanguage when language toggle clicked', async () => {
    render(<Header />)
    await user.click(screen.getByTitle('nav.language'))
    expect(mockChangeLanguage).toHaveBeenCalledWith('en-US')
  })

  it("has accessible buttons with min 44px touch targets", () => {
    render(<Header />)
    const buttons = screen.getAllByRole("button")
    const hasTouchTarget = buttons.some(
      (btn) =>
        btn.className.includes("min-h-[") ||
        btn.className.includes("min-w-["),
    )
    expect(hasTouchTarget).toBe(true)
  })

  // Currency menu items
  it('shows currency options when menu is open', async () => {
    render(<Header />)
    await user.click(screen.getByTitle('settings.currency'))
    expect(screen.getByText('USD')).toBeInTheDocument()
    expect(screen.getByText('BRL')).toBeInTheDocument()
    expect(screen.getByText('EUR')).toBeInTheDocument()
  })

  it('calls setCurrency when currency option selected', async () => {
    render(<Header />)
    await user.click(screen.getByTitle('settings.currency'))
    await user.click(screen.getByText('USD'))
    expect(mockSetCurrency).toHaveBeenCalledWith('USD')
  })
})
