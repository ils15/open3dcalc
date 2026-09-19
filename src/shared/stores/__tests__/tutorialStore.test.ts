import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useTutorialStore, TUTORIAL_TOTAL_STEPS } from '../tutorialStore'

const STORAGE_KEY = 'open3dcalc_tutorial_v1'

describe('useTutorialStore', () => {
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

  // The persistence tests below flush the debounced write with fake timers;
  // always restore the real implementations afterwards so they can never
  // leak into the synchronous tests.
  afterEach(() => {
    vi.useRealTimers()
  })

  // ── startTutorial ──────────────────────────────────────────────
  it('startTutorial() sets isActive: true and currentStep: 1', () => {
    useTutorialStore.getState().startTutorial()
    const state = useTutorialStore.getState()
    expect(state.isActive).toBe(true)
    expect(state.currentStep).toBe(1)
  })

  // ── nextStep ───────────────────────────────────────────────────
  it('nextStep() increments currentStep', () => {
    useTutorialStore.getState().startTutorial()
    useTutorialStore.getState().nextStep()
    expect(useTutorialStore.getState().currentStep).toBe(2)

    // Can't go beyond TOTAL_STEPS
    for (let i = 2; i < TUTORIAL_TOTAL_STEPS; i++) {
      useTutorialStore.getState().nextStep()
    }
    expect(useTutorialStore.getState().currentStep).toBe(TUTORIAL_TOTAL_STEPS)

    // One more should NOT increment
    useTutorialStore.getState().nextStep()
    expect(useTutorialStore.getState().currentStep).toBe(TUTORIAL_TOTAL_STEPS)
  })

  // ── previousStep ───────────────────────────────────────────────
  it('previousStep() decrements currentStep', () => {
    useTutorialStore.getState().startTutorial()
    // Go to step 3 first
    useTutorialStore.getState().goToStep(3)
    expect(useTutorialStore.getState().currentStep).toBe(3)

    useTutorialStore.getState().previousStep()
    expect(useTutorialStore.getState().currentStep).toBe(2)

    useTutorialStore.getState().previousStep()
    expect(useTutorialStore.getState().currentStep).toBe(1)

    // Can't go below 1
    useTutorialStore.getState().previousStep()
    expect(useTutorialStore.getState().currentStep).toBe(1)
  })

  // ── skipTutorial ───────────────────────────────────────────────
  it('skipTutorial() sets isActive: false and resets step', () => {
    useTutorialStore.getState().startTutorial()
    useTutorialStore.getState().goToStep(3)
    expect(useTutorialStore.getState().isActive).toBe(true)

    useTutorialStore.getState().skipTutorial()
    const state = useTutorialStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.currentStep).toBe(1)
  })

  // ── completeStep ───────────────────────────────────────────────
  it('completeStep(n) marks step as completed', () => {
    useTutorialStore.getState().completeStep(1)
    expect(useTutorialStore.getState().completedSteps).toContain(1)
  })

  it('completeStep(n) does not duplicate steps', () => {
    useTutorialStore.getState().completeStep(1)
    useTutorialStore.getState().completeStep(1)
    expect(useTutorialStore.getState().completedSteps).toEqual([1])
  })

  it('completeStep persists to localStorage via debounce', async () => {
    useTutorialStore.getState().completeStep(2)
    // Debounce is 800ms, wait a bit
    await vi.waitFor(() => {
      const raw = localStorage.getItem(STORAGE_KEY)
      expect(raw).not.toBeNull()
      if (raw) {
        const parsed = JSON.parse(raw)
        expect(parsed.completedSteps).toContain(2)
      }
    }, { timeout: 1500 })
  })

  // ── finishTutorial ─────────────────────────────────────────────
  it('finishTutorial() sets isCompleted: true, isActive: false', () => {
    useTutorialStore.getState().startTutorial()
    useTutorialStore.getState().goToStep(5)
    useTutorialStore.getState().finishTutorial()

    const state = useTutorialStore.getState()
    expect(state.isCompleted).toBe(true)
    expect(state.isActive).toBe(false)
  })

  // ── resetTutorial ──────────────────────────────────────────────
  it('resetTutorial() clears all state and removes localStorage', () => {
    useTutorialStore.getState().startTutorial()
    useTutorialStore.getState().goToStep(4)
    useTutorialStore.getState().completeStep(1)
    useTutorialStore.getState().completeStep(2)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ isCompleted: false, completedSteps: [1, 2] }))

    useTutorialStore.getState().resetTutorial()

    const state = useTutorialStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.isCompleted).toBe(false)
    expect(state.currentStep).toBe(1)
    expect(state.completedSteps).toEqual([])
    expect(state.sessionDismissed).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  // ── goToStep ───────────────────────────────────────────────────
  it('goToStep(n) jumps to step n', () => {
    useTutorialStore.getState().startTutorial()
    useTutorialStore.getState().goToStep(5)
    expect(useTutorialStore.getState().currentStep).toBe(5)
  })

  it('goToStep clamps between 1 and TOTAL_STEPS', () => {
    useTutorialStore.getState().startTutorial()
    useTutorialStore.getState().goToStep(0)
    expect(useTutorialStore.getState().currentStep).toBe(1)

    useTutorialStore.getState().goToStep(999)
    expect(useTutorialStore.getState().currentStep).toBe(TUTORIAL_TOTAL_STEPS)
  })

  // ── sessionDismissed ───────────────────────────────────────────
  it('dismissTutorial() sets isActive: false and sessionDismissed: true', () => {
    useTutorialStore.getState().startTutorial()
    useTutorialStore.getState().dismissTutorial()

    const state = useTutorialStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.sessionDismissed).toBe(true)
  })

  // ── State persistence ──────────────────────────────────────────
  // The store reads localStorage exactly once, at module init, so the only
  // honest way to exercise the loader is a fresh module evaluation with the
  // payload already seeded. resetModules() + dynamic import() re-runs the
  // top-level loadPersistedData() against the seeded storage.
  it('loads a real v1 payload from localStorage at module init', async () => {
    // Pre-Fase-2 payloads have no `completedTours` field at all — the loader
    // must tolerate that (default to []) instead of dropping the payload.
    localStorage.clear()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ isCompleted: true, completedSteps: [1, 2, 3, 4, 5, 6, 7] }),
    )

    vi.resetModules()
    const { useTutorialStore: freshStore } = await import('../tutorialStore')

    const state = freshStore.getState()
    expect(state.isCompleted).toBe(true)
    expect(state.completedSteps).toEqual([1, 2, 3, 4, 5, 6, 7])
    // Tolerant default for the field a v1 payload cannot know about.
    expect(state.completedTours).toEqual([])
  })

  it('falls back to safe defaults on a corrupt persisted payload', async () => {
    localStorage.clear()
    localStorage.setItem(STORAGE_KEY, '{ not valid json')

    vi.resetModules()
    const { useTutorialStore: freshStore } = await import('../tutorialStore')

    // Degrades to defaults instead of throwing at import time.
    const state = freshStore.getState()
    expect(state.isCompleted).toBe(false)
    expect(state.completedSteps).toEqual([])
    expect(state.completedTours).toEqual([])
  })

  it('persists finished tours to localStorage via the debounced write', async () => {
    vi.useFakeTimers()
    localStorage.clear()

    vi.resetModules()
    const { useTutorialStore: freshStore } = await import('../tutorialStore')

    freshStore.getState().startTutorial()
    freshStore.getState().finishTutorial()

    // The persist is debounced 800ms — flush it before asserting.
    vi.advanceTimersByTime(800)

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    if (raw) {
      const parsed = JSON.parse(raw)
      expect(parsed.isCompleted).toBe(true)
      expect(parsed.completedTours).toEqual(['calc-basico'])
    }
  })

  // ── Edge cases ─────────────────────────────────────────────────
  it('TUTORIAL_TOTAL_STEPS matches the exported constant', () => {
    expect(TUTORIAL_TOTAL_STEPS).toBe(7)
  })

  it('handles multiple sequential actions correctly', () => {
    useTutorialStore.getState().startTutorial()
    expect(useTutorialStore.getState().isActive).toBe(true)
    expect(useTutorialStore.getState().currentStep).toBe(1)

    useTutorialStore.getState().nextStep()
    useTutorialStore.getState().nextStep()
    expect(useTutorialStore.getState().currentStep).toBe(3)

    useTutorialStore.getState().previousStep()
    expect(useTutorialStore.getState().currentStep).toBe(2)

    useTutorialStore.getState().goToStep(7)
    expect(useTutorialStore.getState().currentStep).toBe(7)

    useTutorialStore.getState().previousStep()
    expect(useTutorialStore.getState().currentStep).toBe(6)
  })
})
