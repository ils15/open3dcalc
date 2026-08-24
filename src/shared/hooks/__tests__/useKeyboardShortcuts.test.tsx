import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useKeyboardShortcuts, type Shortcut } from "../useKeyboardShortcuts";

function Harness({ shortcuts }: { shortcuts: Shortcut[] }) {
  useKeyboardShortcuts(shortcuts);
  return (
    <div>
      <input data-testid="input" />
      <textarea data-testid="textarea" />
      <div data-testid="editable" contentEditable />
      <button data-testid="button" type="button">
        Button
      </button>
    </div>
  );
}

function fireKey(
  target: EventTarget,
  key: string,
  opts: { ctrl?: boolean; shift?: boolean } = {},
): KeyboardEvent {
  const evt = new KeyboardEvent("keydown", {
    key,
    ctrlKey: opts.ctrl ?? false,
    shiftKey: opts.shift ?? false,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(evt);
  return evt;
}

describe("useKeyboardShortcuts", () => {
  it("triggers the handler when the shortcut is pressed outside an editable element", () => {
    const handler = vi.fn();
    render(
      <Harness
        shortcuts={[{ key: "z", ctrl: true, handler, description: "undo" }]}
      />,
    );
    fireKey(window, "z", { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("prevents default when the shortcut is handled outside an editable element", () => {
    const handler = vi.fn();
    render(
      <Harness
        shortcuts={[{ key: "z", ctrl: true, handler, description: "undo" }]}
      />,
    );
    const evt = fireKey(window, "z", { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(evt.defaultPrevented).toBe(true);
  });

  it("skips the handler when focus is in an input, leaving native undo intact", () => {
    const handler = vi.fn();
    render(
      <Harness
        shortcuts={[{ key: "z", ctrl: true, handler, description: "undo" }]}
      />,
    );
    const evt = fireKey(screen.getByTestId("input"), "z", { ctrl: true });
    expect(handler).not.toHaveBeenCalled();
    expect(evt.defaultPrevented).toBe(false);
  });

  it("skips the handler when focus is in a textarea", () => {
    const handler = vi.fn();
    render(
      <Harness
        shortcuts={[{ key: "z", ctrl: true, handler, description: "undo" }]}
      />,
    );
    fireKey(screen.getByTestId("textarea"), "z", { ctrl: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("skips the handler when focus is in a contentEditable element", () => {
    const handler = vi.fn();
    render(
      <Harness
        shortcuts={[{ key: "z", ctrl: true, handler, description: "undo" }]}
      />,
    );
    fireKey(screen.getByTestId("editable"), "z", { ctrl: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("applies the same exclusion to Ctrl+Shift+Z shortcuts", () => {
    const handler = vi.fn();
    render(
      <Harness
        shortcuts={[
          { key: "z", ctrl: true, shift: true, handler, description: "redo" },
        ]}
      />,
    );
    fireKey(screen.getByTestId("input"), "z", { ctrl: true, shift: true });
    expect(handler).not.toHaveBeenCalled();
    fireKey(window, "z", { ctrl: true, shift: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
