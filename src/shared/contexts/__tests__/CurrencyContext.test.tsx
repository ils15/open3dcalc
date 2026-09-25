import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useCurrency,
  useCurrencyPreference,
  useSetCurrency,
} from "../CurrencyContext";
import { CurrencyProvider } from "../CurrencyProvider";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

const actionConsumerRenders = vi.fn();

function CurrencyValues(): React.ReactElement {
  const { currency, symbol } = useCurrency();
  const { currencySetting } = useCurrencyPreference();

  return (
    <div>
      <span data-testid="currency">{currency}</span>
      <span data-testid="symbol">{symbol}</span>
      <span data-testid="currency-setting">{currencySetting}</span>
    </div>
  );
}

function CurrencyAction(): React.ReactElement {
  const setCurrency = useSetCurrency();
  actionConsumerRenders();

  return (
    <button type="button" onClick={() => setCurrency("EUR")}>
      Set euro
    </button>
  );
}

describe("CurrencyProvider", () => {
  beforeEach(() => {
    actionConsumerRenders.mockClear();
    useCalculatorStore.setState({ currency: "auto" });
  });

  it("exposes the existing store value, formatter data, and action", () => {
    render(
      <CurrencyProvider>
        <CurrencyValues />
        <CurrencyAction />
      </CurrencyProvider>,
    );

    expect(screen.getByTestId("currency-setting")).toHaveTextContent("auto");

    const actionRendersBeforeChange = actionConsumerRenders.mock.calls.length;
    act(() => screen.getByRole("button", { name: "Set euro" }).click());

    expect(useCalculatorStore.getState().currency).toBe("EUR");
    expect(screen.getByTestId("currency")).toHaveTextContent("EUR");
    expect(screen.getByTestId("symbol")).toHaveTextContent("€");
    expect(screen.getByTestId("currency-setting")).toHaveTextContent("EUR");
    expect(actionConsumerRenders).toHaveBeenCalledTimes(
      actionRendersBeforeChange,
    );
  });
});
