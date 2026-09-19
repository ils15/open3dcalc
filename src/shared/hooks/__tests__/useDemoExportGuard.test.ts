import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { useDemoExportGuard } from "../useDemoExportGuard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

interface MockDemoModeState {
  isActive: boolean;
  enter: () => void;
  exit: () => void;
}

const mockState: MockDemoModeState = {
  isActive: false,
  enter: vi.fn(),
  exit: vi.fn(),
};

function mockDemoModeStore(): MockDemoModeState;
function mockDemoModeStore<T>(selector: (state: MockDemoModeState) => T): T;
function mockDemoModeStore(
  selector?: (state: MockDemoModeState) => unknown,
): unknown {
  return selector ? selector(mockState) : mockState;
}

vi.mock("@/shared/stores/demoModeStore", () => ({
  useDemoModeStore: Object.assign(mockDemoModeStore, {
    getState: () => mockState,
  }),
}));

describe("useDemoExportGuard", () => {
  beforeEach(() => {
    mockState.isActive = false;
    vi.clearAllMocks();
  });

  it("allows the action while demo is inactive", () => {
    const onBlocked = vi.fn();

    const { result } = renderHook(() => useDemoExportGuard(onBlocked));

    expect(result.current.guard()).toBe(false);
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("blocks the action and explains why while demo is active", () => {
    mockState.isActive = true;
    const onBlocked = vi.fn();

    const { result } = renderHook(() => useDemoExportGuard(onBlocked));

    expect(result.current.guard()).toBe(true);
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(onBlocked).toHaveBeenCalledWith("demo.export.blockedTitle");
  });

  it("still blocks when no feedback callback is wired", () => {
    mockState.isActive = true;

    const { result } = renderHook(() => useDemoExportGuard());

    expect(result.current.guard()).toBe(true);
  });

  it("exposes isDemoMode to render the marking", () => {
    const { result } = renderHook(() => useDemoExportGuard());
    expect(result.current.isDemoMode).toBe(false);

    mockState.isActive = true;
    const { result: active } = renderHook(() => useDemoExportGuard());
    expect(active.current.isDemoMode).toBe(true);
  });
});
