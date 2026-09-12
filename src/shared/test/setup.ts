import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock window.matchMedia for components that use useReducedMotion
// Only apply in jsdom/browser environments — guards against node-only tests
// (e.g., db/__tests__/schema.test.ts with @vitest-environment node)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}
