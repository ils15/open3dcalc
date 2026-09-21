import { create } from "zustand";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import {
  type TourId,
  DEFAULT_TOUR,
  getTourSteps,
  TOUR_IDS,
} from "@/shared/components/ui/tutorialTours";

const STORAGE_KEY = "open3dcalc_tutorial_v1";

interface PersistedTutorialData {
  isCompleted: boolean;
  completedSteps: number[];
  /** Tours the user finished. Absent in pre-Fase-2 payloads. */
  completedTours: TourId[];
}

interface TutorialState {
  isActive: boolean;
  activeTour: TourId;
  isCompleted: boolean;
  completedSteps: number[];
  completedTours: TourId[];
  /** Dismissed for the current session (non-persistent) */
  sessionDismissed: boolean;
  currentStep: number;

  startTutorial: () => void;
  startTour: (tourId: TourId) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  completeStep: (step: number) => void;
  finishTutorial: () => void;
  skipTutorial: () => void;
  dismissTutorial: () => void;
  resetTutorial: () => void;
}

// --- persistence helpers (mirrors calculatorStore.helpers) ---

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedPersist(
  state: Pick<TutorialState, "isCompleted" | "completedSteps" | "completedTours">,
) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    guardedStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        isCompleted: state.isCompleted,
        completedSteps: state.completedSteps,
        completedTours: state.completedTours,
      } satisfies PersistedTutorialData),
    );
  }, 800);
}

function loadPersistedData(): PersistedTutorialData {
  if (typeof window === "undefined") {
    return { isCompleted: false, completedSteps: [], completedTours: [] };
  }
  try {
    const raw = guardedStorage.getItem(STORAGE_KEY);
    if (!raw) return { isCompleted: false, completedSteps: [], completedTours: [] };
    const parsed = JSON.parse(raw) as Partial<PersistedTutorialData>;
    const completedTours = (parsed.completedTours ?? []).filter((t) =>
      TOUR_IDS.includes(t as TourId),
    );
    return {
      isCompleted: parsed.isCompleted ?? false,
      completedSteps: Array.isArray(parsed.completedSteps)
        ? parsed.completedSteps
        : [],
      completedTours,
    };
  } catch {
    return { isCompleted: false, completedSteps: [], completedTours: [] };
  }
}

// --- store ---

const initialState = loadPersistedData();

export const useTutorialStore = create<TutorialState>((set, get) => ({
  // persisted state
  isCompleted: initialState.isCompleted,
  completedSteps: initialState.completedSteps,
  completedTours: initialState.completedTours,

  // transient state (not persisted)
  isActive: false,
  activeTour: DEFAULT_TOUR,
  currentStep: 1,
  sessionDismissed: false,

  // --- actions ---

  /** Backwards-compatible entry point — starts the default (basic) tour. */
  startTutorial: () => {
    get().startTour(DEFAULT_TOUR);
  },

  startTour: (tourId) => {
    if (getTourSteps(tourId).length === 0) return;
    set({ isActive: true, activeTour: tourId, currentStep: 1 });
  },

  nextStep: () => {
    const { currentStep, activeTour } = get();
    const total = getTourSteps(activeTour).length;
    if (currentStep < total) {
      set({ currentStep: currentStep + 1 });
    }
  },

  previousStep: () => {
    const { currentStep } = get();
    if (currentStep > 1) {
      set({ currentStep: currentStep - 1 });
    }
  },

  goToStep: (step) => {
    const total = getTourSteps(get().activeTour).length;
    const clamped = Math.max(1, Math.min(step, total));
    set({ currentStep: clamped });
  },

  completeStep: (step) => {
    set((state) => {
      if (state.completedSteps.includes(step)) return state;
      const completedSteps = [...state.completedSteps, step].sort(
        (a, b) => a - b,
      );
      debouncedPersist({ ...state, completedSteps });
      return { completedSteps };
    });
  },

  finishTutorial: () => {
    set((state) => {
      // Only the default tour gates the first-visit auto-start.
      const isCompleted =
        state.isCompleted || state.activeTour === DEFAULT_TOUR;
      const completedTours = state.completedTours.includes(state.activeTour)
        ? state.completedTours
        : [...state.completedTours, state.activeTour];
      debouncedPersist({
        isCompleted,
        completedSteps: state.completedSteps,
        completedTours,
      });
      return { isCompleted, completedTours, isActive: false };
    });
  },

  skipTutorial: () => {
    set({ isActive: false, currentStep: 1 });
  },

  dismissTutorial: () => {
    set({ isActive: false, sessionDismissed: true });
  },

  resetTutorial: () => {
    const fresh: PersistedTutorialData = {
      isCompleted: false,
      completedSteps: [],
      completedTours: [],
    };
    set({
      ...fresh,
      isActive: false,
      activeTour: DEFAULT_TOUR,
      currentStep: 1,
      sessionDismissed: false,
    });
    guardedStorage.removeItem(STORAGE_KEY);
  },
}));

/** React selector for the active tour's length. */
export function useTourStepCount(): number {
  return useTutorialStore((s) => getTourSteps(s.activeTour).length);
}

/** Legacy constant — the default tour's length (7). Kept for older callers. */
export const TUTORIAL_TOTAL_STEPS = getTourSteps(DEFAULT_TOUR).length;
