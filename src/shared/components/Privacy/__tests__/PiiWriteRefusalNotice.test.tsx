/**
 * H-4 — the visible consumer of `getLastPiiWriteRefusal()`.
 *
 * Local persistence records a refusal outside React; this component subscribes and shows
 * it the instant it happens, so a refused PII write is impossible to miss. The
 * specs pin: it renders nothing when idle, names the affected data area and the
 * typed reason when a real refusal exists and filters to its own store.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${Object.values(options).join(" ")}` : key,
  }),
}));

import { PiiWriteRefusalNotice } from "../PiiWriteRefusalNotice";
import {
  PII_STORE_KEY,
  recordPiiWriteRefusal,
  resetLocalPiiPersistenceForTests,
} from "@/shared/lib/localPiiPersistence";

describe("H-4 — PiiWriteRefusalNotice", () => {
  beforeEach(() => {
    resetLocalPiiPersistenceForTests();
  });

  afterEach(() => {
    resetLocalPiiPersistenceForTests();
  });

  it("renders nothing while no write has been refused", () => {
    const { container } = render(
      <PiiWriteRefusalNotice storeKey={PII_STORE_KEY.customers} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the refusal, the data area and the typed reason", () => {
    recordPiiWriteRefusal(PII_STORE_KEY.customers, "storage_not_ready");

    render(<PiiWriteRefusalNotice storeKey={PII_STORE_KEY.customers} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("privacy.localData.writeRefusedTitle");
    // The area label is resolved through the existing customers.title key.
    expect(alert).toHaveTextContent("customers.title");
    expect(alert).toHaveTextContent("storage_not_ready");
  });

  it("only renders a refusal that matches its own store", () => {
    recordPiiWriteRefusal(PII_STORE_KEY.customers, "storage_not_ready");

    const { container } = render(
      <PiiWriteRefusalNotice storeKey={PII_STORE_KEY.quotes} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("falls back to a generic area label for an unknown store key", () => {
    recordPiiWriteRefusal("open3dcalc_unknown_store", "storage_not_ready");

    render(<PiiWriteRefusalNotice />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "privacy.localData.writeRefusedAreaUnknown",
    );
  });

  it("appears as soon as a refusal arrives after mount", () => {
    render(<PiiWriteRefusalNotice storeKey={PII_STORE_KEY.customers} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => {
      recordPiiWriteRefusal(PII_STORE_KEY.customers, "storage_not_ready");
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "privacy.localData.writeRefusedTitle",
    );
  });
});
