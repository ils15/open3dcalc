import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Tutorial } from '../Tutorial'
import { useTutorialStore } from '@/shared/stores/tutorialStore'
import { useCalculatorStore } from '@/shared/stores/calculatorStore'
import type { TourId, StepConfig, TutorialTab } from '../tutorialTours'

// ── Mocks ────────────────────────────────────────────────────────────

// Mock react-i18next with interpolation support
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'tutorial.steps.welcome.title': 'Bem-vindo ao Open3DCalc! 🎉',
        'tutorial.steps.welcome.description': 'Calculadora 3D completa.',
        'tutorial.steps.material.title': 'Materiais',
        'tutorial.steps.material.description': 'Selecione o filamento.',
        'tutorial.steps.print.title': 'Parâmetros de Impressão',
        'tutorial.steps.print.description': 'Defina o tempo.',
        'tutorial.steps.sales.title': 'Precificação',
        'tutorial.steps.sales.description': 'Configure a margem.',
        'tutorial.steps.results.title': 'Resultados',
        'tutorial.steps.results.description': 'Resultados calculados.',
        'tutorial.steps.export.title': 'Exportar',
        'tutorial.steps.export.description': 'Exporte seus dados.',
        'tutorial.steps.complete.title': 'Tudo pronto! 🚀',
        'tutorial.steps.complete.description': 'Você já sabe usar!',
        'tutorial.stepOf': 'Passo {{current}} de {{total}}',
        'tutorial.next': 'Próximo',
        'tutorial.previous': 'Anterior',
        'tutorial.skip': 'Pular',
        'tutorial.finish': 'Concluir',
        'common.close': 'Fechar',
        'tutorial.start': 'Iniciar Tutorial',
        'tutorial.dismiss': 'Dispensar',
      }
      let text = translations[key] ?? key
      // Simple interpolation: replace {{var}} with params
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
        }
      }
      return text
    },
  }),
}))

// Mock Floating UI
vi.mock('@floating-ui/react', () => ({
  useFloating: () => ({
    refs: { setFloating: vi.fn(), setReference: vi.fn() },
    floatingStyles: { position: 'absolute', top: 0, left: 0 },
    placement: 'right-start',
  }),
  offset: () => () => ({ x: 0, y: 0 }),
  flip: () => () => ({ x: 0, y: 0 }),
  shift: () => () => ({ x: 0, y: 0 }),
  autoUpdate: vi.fn(),
  FloatingPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { initial, animate, exit, transition, ...rest } = props
      return <div {...rest}>{children}</div>
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon-x">X</span>,
  ChevronLeft: () => <span data-testid="icon-chevron-left">{'<'}</span>,
  ChevronRight: () => <span data-testid="icon-chevron-right">{'>'}</span>,
}))

// No real tour uses `level:` yet (nivel-avancado is empty until Fase 3), so the
// level-restore path would have zero coverage. The factory fills that tour with
// a synthetic level-gated step; the rest mirrors the real registry.
//
// The factory MUST stay synchronous: an async one (importOriginal) resolves
// only after the statically-imported store/component have already evaluated,
// so they would still see the real (empty) registry.
vi.mock('../tutorialTours', () => {
  const TOURS: Record<TourId, StepConfig[]> = {
    'calc-basico': [
      { key: 'welcome', target: null },
      { key: 'material', target: '[data-tutorial="material"]' },
      { key: 'print', target: '[data-tutorial="print"]' },
      { key: 'sales', target: '[data-tutorial="sales"]' },
      {
        key: 'results',
        target: '[data-tutorial="results-sidebar"], [data-tutorial="results"]',
      },
      { key: 'export', target: '[data-tutorial="export"]' },
      { key: 'complete', target: null },
    ],
    'upload-3d-preview': [],
    'inventario-bobinas': [],
    'dashboard-kpis': [],
    'orcamentos-clientes': [],
    'nivel-avancado': [
      {
        key: 'adv-level',
        target: '[data-tutorial="adv-anchor"]',
        level: 'advanced',
      },
      { key: 'adv-complete', target: null },
    ],
  }

  const TOUR_IDS: TourId[] = [
    'calc-basico',
    'upload-3d-preview',
    'inventario-bobinas',
    'dashboard-kpis',
    'orcamentos-clientes',
    'nivel-avancado',
  ]

  const TUTORIAL_TABS: TutorialTab[] = [
    'calculator',
    'dashboard',
    'infill',
    'inventory',
    'catalog',
    'history',
    'changelog',
    'quotes',
    'customers',
    'products',
    'privacy',
  ]

  const getTourSteps = (tourId: TourId): StepConfig[] => TOURS[tourId] ?? []
  const getTourStepCount = (tourId: TourId): number =>
    (TOURS[tourId] ?? []).length
  const isTourAvailable = (tourId: TourId): boolean =>
    getTourStepCount(tourId) > 0

  const dispatchTutorialNavigate = (tab: TutorialTab): void => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent<TutorialTab>('open3dcalc:tutorial-navigate', {
        detail: tab,
      }),
    )
  }

  return {
    TOUR_IDS,
    TUTORIAL_TABS,
    TOURS,
    DEFAULT_TOUR: 'calc-basico',
    getTourSteps,
    getTourStepCount,
    isTourAvailable,
    TUTORIAL_NAVIGATE_EVENT: 'open3dcalc:tutorial-navigate',
    dispatchTutorialNavigate,
  }
})

describe('Tutorial', () => {
  beforeEach(() => {
    localStorage.clear()
    useTutorialStore.setState({
      isActive: false,
      isCompleted: false,
      currentStep: 1,
      completedSteps: [],
      sessionDismissed: false,
    })
  })

  // ── Rendering ──────────────────────────────────────────────────
  it('renders nothing when not active', () => {
    const { container } = render(<Tutorial />)
    expect(container.innerHTML).toBe('')
  })

  it('renders tooltip card when active', () => {
    useTutorialStore.getState().startTutorial()
    render(<Tutorial />)
    expect(screen.getByText('Bem-vindo ao Open3DCalc! 🎉')).toBeInTheDocument()
  })

  it('shows step counter (1 / 7)', () => {
    useTutorialStore.getState().startTutorial()
    render(<Tutorial />)
    expect(screen.getByText('Passo 1 de 7')).toBeInTheDocument()
  })

  // ── Navigation ─────────────────────────────────────────────────
  it('"Próximo" button advances to next step', () => {
    useTutorialStore.getState().startTutorial()
    render(<Tutorial />)
    fireEvent.click(screen.getByText('Próximo'))
    expect(screen.getByText('Materiais')).toBeInTheDocument()
    expect(screen.getByText('Passo 2 de 7')).toBeInTheDocument()
  })

  it('"Voltar" button goes to previous step', () => {
    useTutorialStore.getState().startTutorial()
    useTutorialStore.getState().goToStep(3)
    render(<Tutorial />)
    // Should be on step 3 with "Anterior" button visible
    fireEvent.click(screen.getByLabelText('Anterior'))
    expect(screen.getByText('Passo 2 de 7')).toBeInTheDocument()
  })

  it('"Pular" button closes tutorial', () => {
    useTutorialStore.getState().startTutorial()
    render(<Tutorial />)
    fireEvent.click(screen.getByText('Pular'))
    expect(useTutorialStore.getState().isActive).toBe(false)
  })

  it('last step shows "Concluir" instead of "Próximo"', () => {
    useTutorialStore.getState().startTutorial()
    useTutorialStore.getState().goToStep(7)
    render(<Tutorial />)
    expect(screen.getByText('Concluir')).toBeInTheDocument()
    expect(screen.queryByText('Próximo')).not.toBeInTheDocument()
  })

  // ── Finish button ──────────────────────────────────────────────
  it('"Concluir" button finishes tutorial', () => {
    useTutorialStore.getState().startTutorial()
    useTutorialStore.getState().goToStep(7)
    render(<Tutorial />)
    fireEvent.click(screen.getByText('Concluir'))
    const state = useTutorialStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.isCompleted).toBe(true)
  })

  // ── Close button ───────────────────────────────────────────────
  it('X close button finishes tutorial', () => {
    useTutorialStore.getState().startTutorial()
    render(<Tutorial />)
    const closeButton = screen.getByLabelText('Fechar')
    expect(closeButton).toBeInTheDocument()
    fireEvent.click(closeButton)
    expect(useTutorialStore.getState().isActive).toBe(false)
    expect(useTutorialStore.getState().isCompleted).toBe(true)
  })

  // ── Spotlight overlay click ────────────────────────────────────
  it('clicking the overlay dismisses tutorial', () => {
    useTutorialStore.getState().startTutorial()
    useTutorialStore.getState().goToStep(2) // step 2 (material) has a spotlight target
    render(<Tutorial />)
    const overlay = document.querySelector('[data-testid="tutorial-overlay"]')
    expect(overlay).not.toBeNull()
    if (overlay) {
      fireEvent.click(overlay)
    }
    const state = useTutorialStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.sessionDismissed).toBe(true)
  })

  // ── Degraded fallback (missing anchor) ────────────────────────
  it('degrades to a centered card without overlay when the anchor never mounts', async () => {
    useTutorialStore.getState().startTutorial()
    useTutorialStore.getState().goToStep(2) // "material" step — its anchor is NOT rendered
    render(<Tutorial />)

    // The card renders right away...
    expect(screen.getByText('Materiais')).toBeInTheDocument()

    // ...and once the retry loop gives up the overlay is suppressed instead of
    // blocking the tour on a surface that isn't rendered.
    await vi.waitFor(
      () => {
        expect(document.querySelector('[data-testid="tutorial-overlay"]')).toBeNull()
      },
      { timeout: 2500 },
    )

    // The tour stays usable: card still on screen (centered), tour still active.
    expect(screen.getByText('Materiais')).toBeInTheDocument()
    expect(useTutorialStore.getState().isActive).toBe(true)
  })

  // ── Keyboard: Escape ───────────────────────────────────────────
  it('Escape key closes tutorial', () => {
    useTutorialStore.getState().startTutorial()
    render(<Tutorial />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useTutorialStore.getState().isActive).toBe(false)
  })

  // ── Keyboard: ArrowRight ───────────────────────────────────────
  it('ArrowRight key advances to next step', () => {
    useTutorialStore.getState().startTutorial()
    render(<Tutorial />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('Passo 2 de 7')).toBeInTheDocument()
  })

  // ── Keyboard: ArrowLeft ────────────────────────────────────────
  it('ArrowLeft key goes to previous step', () => {
    useTutorialStore.getState().startTutorial()
    useTutorialStore.getState().goToStep(3)
    render(<Tutorial />)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('Passo 2 de 7')).toBeInTheDocument()
  })

  // ── Session dismissed ──────────────────────────────────────────
  it('does not show tutorial if sessionDismissed is true (isActive false)', () => {
    useTutorialStore.setState({ isActive: false, sessionDismissed: true })
    const { container } = render(<Tutorial />)
    expect(container.innerHTML).toBe('')
  })

  it('does not show tutorial if sessionDismissed is true (isActive true)', () => {
    useTutorialStore.setState({ isActive: true, sessionDismissed: true })
    const { container } = render(<Tutorial />)
    expect(container.innerHTML).toBe('')
  })

  // ── Level restore ─────────────────────────────────────────────
  // `nivel-avancado` borrows the calculator level to unlock gated sections
  // and must give it back on every exit path — the tour must not change the
  // user's durable calculator settings.
  it('switches calcLevel for a level-gated step and restores it on finish', () => {
    useCalculatorStore.setState({ calcLevel: 'basic' })
    useTutorialStore.getState().startTour('nivel-avancado')
    render(<Tutorial />)

    // Step 1 borrows the level...
    expect(useCalculatorStore.getState().calcLevel).toBe('advanced')

    // Step 2 (centered card, no target) must not touch the level again.
    fireEvent.click(screen.getByText('Próximo'))
    expect(useCalculatorStore.getState().calcLevel).toBe('advanced')

    // ...and finishing gives it back.
    fireEvent.click(screen.getByText('Concluir'))
    expect(useTutorialStore.getState().isActive).toBe(false)
    expect(useCalculatorStore.getState().calcLevel).toBe('basic')
  })

  it('restores calcLevel when the user skips the level-gated tour', () => {
    // A different starting level than the test above proves restore uses the
    // captured previous value, not a hardcoded default.
    useCalculatorStore.setState({ calcLevel: 'intermediate' })
    useTutorialStore.getState().startTour('nivel-avancado')
    render(<Tutorial />)

    expect(useCalculatorStore.getState().calcLevel).toBe('advanced')

    fireEvent.click(screen.getByText('Pular'))
    expect(useTutorialStore.getState().isActive).toBe(false)
    expect(useCalculatorStore.getState().calcLevel).toBe('intermediate')
  })

  // ── Complete — hide ────────────────────────────────────────────
  it('does not show tutorial if already completed', () => {
    useTutorialStore.setState({
      isActive: false,
      isCompleted: true,
    })
    const { container } = render(<Tutorial />)
    expect(container.innerHTML).toBe('')
  })
})
