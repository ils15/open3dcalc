import { create } from "zustand";
import { guardedStorage } from "@/shared/lib/manifestStorage";

const STORAGE_KEY = "open3dcalc_tutorial_v1";
const TOTAL_STEPS = 7;

interface PersistedTutorialData {
  isCompleted: boolean;
  completedSteps: number[];
}

interface TutorialState extends PersistedTutorialData {
  isActive: boolean;
  currentStep: number;
  /** Dismissed for the current session (non-persistent) */
  sessionDismissed: boolean;

  startTutorial: () => void;
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
  state: Pick<TutorialState, "isCompleted" | "completedSteps">,
) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    guardedStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        isCompleted: state.isCompleted,
        completedSteps: state.completedSteps,
      } satisfies PersistedTutorialData),
    );
  }, 800);
}

function loadPersistedData(): PersistedTutorialData {
  if (typeof window === "undefined") {
    return { isCompleted: false, completedSteps: [] };
  }
  try {
    const raw = guardedStorage.getItem(STORAGE_KEY);
    if (!raw) return { isCompleted: false, completedSteps: [] };
    const parsed = JSON.parse(raw) as Partial<PersistedTutorialData>;
    return {
      isCompleted: parsed.isCompleted ?? false,
      completedSteps: Array.isArray(parsed.completedSteps)
        ? parsed.completedSteps
        : [],
    };
  } catch {
    return { isCompleted: false, completedSteps: [] };
  }
}

// --- store ---

const initialState: PersistedTutorialData = loadPersistedData();

export const useTutorialStore = create<TutorialState>((set, get) => ({
  // persisted state
  isCompleted: initialState.isCompleted,
  completedSteps: initialState.completedSteps,

  // transient state (not persisted)
  isActive: false,
  currentStep: 1,
  sessionDismissed: false,

  // --- actions ---

  startTutorial: () => {
    set({ isActive: true, currentStep: 1 });
  },

  nextStep: () => {
    const { currentStep } = get();
    if (currentStep < TOTAL_STEPS) {
      set({ currentStep: currentStep + 1 });
    }
  },

  previousStep: () => {
    const { currentStep } = get();
    if (currentStep > 1) {
      set({ currentStep: currentStep - 1 });
    }
  },

  goToStep: (step: number) => {
    const clamped = Math.max(1, Math.min(step, TOTAL_STEPS));
    set({ currentStep: clamped });
  },

  completeStep: (step: number) => {
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
      const isCompleted = true;
      debouncedPersist({ isCompleted, completedSteps: state.completedSteps });
      return { isCompleted, isActive: false };
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
    };
    set({ ...fresh, isActive: false, currentStep: 1, sessionDismissed: false });
    guardedStorage.removeItem(STORAGE_KEY);
  },
}));

export const TUTORIAL_TOTAL_STEPS = TOTAL_STEPS;
