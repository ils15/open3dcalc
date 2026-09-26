import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ToastContainer, type ToastItem } from "../Toast";

describe("ToastContainer", () => {
  const items: ToastItem[] = [
    { id: 1, message: "Success!", type: "success" },
    { id: 2, message: "Error occurred", type: "error" },
  ];

  it("renders the region with correct aria attributes", () => {
    render(<ToastContainer items={items} onDismiss={vi.fn()} />);
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-label", "Notificações");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("positions toasts at bottom on mobile (bottom-4 left-4 right-4)", () => {
    render(<ToastContainer items={items} onDismiss={vi.fn()} />);
    const region = screen.getByRole("region");
    expect(region.className).toContain("bottom-4");
    expect(region.className).toContain("left-4");
    expect(region.className).toContain("right-4");
  });

  it("positions toasts at top-right on desktop (sm:top-4 sm:right-4 sm:left-auto sm:bottom-auto)", () => {
    render(<ToastContainer items={items} onDismiss={vi.fn()} />);
    const region = screen.getByRole("region");
    expect(region.className).toContain("sm:top-4");
    expect(region.className).toContain("sm:right-4");
    expect(region.className).toContain("sm:left-auto");
    expect(region.className).toContain("sm:bottom-auto");
  });

  it("has sm:max-w-sm for desktop width constraint", () => {
    render(<ToastContainer items={items} onDismiss={vi.fn()} />);
    const region = screen.getByRole("region");
    expect(region.className).toContain("sm:max-w-sm");
  });

  it("does NOT have fixed max-w-sm (should only apply at sm+)", () => {
    render(<ToastContainer items={items} onDismiss={vi.fn()} />);
    const region = screen.getByRole("region");
    // Should not have standalone max-w-sm (without sm: prefix)
    // The class string contains "sm:max-w-sm" but not a bare "max-w-sm"
    const classes = region.className;
    // Split into individual tokens and check for exact "max-w-sm" token
    const tokens = classes.split(/\s+/);
    expect(tokens).not.toContain("max-w-sm");
  });

  it("renders all toast items", () => {
    render(<ToastContainer items={items} onDismiss={vi.fn()} />);
    expect(screen.getByText("Success!")).toBeInTheDocument();
    expect(screen.getByText("Error occurred")).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<ToastContainer items={items} onDismiss={onDismiss} />);
    const dismissButtons = screen.getAllByLabelText("Fechar");
    fireEvent.click(dismissButtons[0]);
    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  it("takes its layer from the scale, and not from the modal tier", () => {
    // This used to assert `z-50`, which is precisely the defect: a toast owns
    // no scrim, no focus trap and no key, so it had no business in the scrim-
    // modal tier — at sm+ it shares the Focus Mode exit's top-right anchor and
    // covered the only way out of the mode for four seconds. Asserting the
    // named step keeps the ordering question in tokens.css, where it belongs.
    render(<ToastContainer items={items} onDismiss={vi.fn()} />);
    const region = screen.getByRole("region");
    expect(region.style.zIndex).toBe("var(--z-passive)");
    expect(region.className).not.toContain("z-50");
  });

  it("renders empty container when no items", () => {
    const { container } = render(
      <ToastContainer items={[]} onDismiss={vi.fn()} />,
    );
    const region = container.querySelector('[role="region"]');
    expect(region).toBeInTheDocument();
    expect(region?.children.length).toBe(0);
  });
});
