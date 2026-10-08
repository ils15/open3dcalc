/**
 * Desktop plaintext-persistence status surface.
 *
 * It must render the plaintext-at-rest limitation only after a route-backed
 * record exists, and render nothing on the web build or when the route is
 * unavailable.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { PasswordlessPiiStatus } from "../PasswordlessPiiStatus";
import { NEW_PII_RECORD_SAVED_EVENT } from "@/platform/desktop/overrides/newPiiStorage";

type PiiNew = {
  capability: () => Promise<{
    available: boolean;
    backend?: string;
    reason?: string;
  }>;
  load: (key: string) => Promise<string | null>;
  save: (key: string, value: string) => Promise<void>;
};

function installRoute(
  capability: PiiNew["capability"],
  load: PiiNew["load"] = async () => null,
): PiiNew {
  const route: PiiNew = {
    capability: vi.fn(capability),
    load: vi.fn(load),
    save: vi.fn(async () => undefined),
  };
  (window as unknown as { electronAPI?: unknown }).electronAPI = {
    piiNew: route,
  };
  return route;
}

beforeEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe("PasswordlessPiiStatus", () => {
  it("renders nothing on the web build (no route)", async () => {
    render(<PasswordlessPiiStatus />);
    await waitFor(() =>
      expect(screen.queryByTestId("passwordless-pii-status")).toBeNull(),
    );
  });

  it("does not claim stored data exists until a plaintext record exists", async () => {
    const route = installRoute(async () => ({
      available: true,
      backend: "plaintext",
    }));
    render(<PasswordlessPiiStatus />);

    await waitFor(() => expect(route.capability).toHaveBeenCalledOnce());
    expect(route.load).toHaveBeenCalled();
    expect(screen.queryByTestId("passwordless-pii-status")).toBeNull();
  });

  it("shows the plaintext limitation after a record exists", async () => {
    const route = installRoute(
      async () => ({ available: true, backend: "plaintext" }),
      async () => JSON.stringify({ state: {}, version: 1 }),
    );
    render(<PasswordlessPiiStatus />);

    expect(
      await screen.findByTestId("passwordless-pii-status"),
    ).toBeInTheDocument();
    expect(route.load).toHaveBeenCalled();
    expect(
      screen.getByText("privacy.passwordless.limitation"),
    ).toBeInTheDocument();
  });

  it("appears after the first route-backed save in the current session", async () => {
    const route = installRoute(async () => ({
      available: true,
      backend: "plaintext",
    }));
    render(<PasswordlessPiiStatus />);

    await waitFor(() => expect(route.load).toHaveBeenCalled());
    expect(screen.queryByTestId("passwordless-pii-status")).toBeNull();
    window.dispatchEvent(new Event(NEW_PII_RECORD_SAVED_EVENT));

    expect(
      await screen.findByTestId("passwordless-pii-status"),
    ).toBeInTheDocument();
  });

  it("renders nothing when the gate is refused", async () => {
    installRoute(async () => ({
      available: false,
      reason: "backend_basic_text",
    }));
    render(<PasswordlessPiiStatus />);
    await waitFor(() =>
      expect(screen.queryByTestId("passwordless-pii-status")).toBeNull(),
    );
  });
});
