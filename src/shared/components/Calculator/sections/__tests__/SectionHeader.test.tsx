import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wrench, type LucideIcon } from "lucide-react";
import { SectionHeader } from "../SectionHeader";

/** Deterministic icon so the baseline string does not depend on lucide paths. */
function StubIcon({ className }: { className?: string }) {
  return <svg data-testid="stub-icon" className={className} />;
}

const stubIcon = StubIcon as unknown as LucideIcon;

/**
 * Markup captured from the component BEFORE the `metric` prop existed
 * (rendered, not deduced). Without a metric the header must keep producing
 * exactly this string — a diff here means the no-metric path regressed.
 */
const BASELINE_WITH_STEP =
  '<div class="flex items-center gap-2 mb-2 pb-1.5 border-b border-[var(--border-default)]">' +
  '<span aria-hidden="true" data-testid="step-badge" class="flex shrink-0 items-center justify-center rounded-full font-semibold leading-none h-5 w-5 text-[10px] bg-[var(--color-bg-elevated)]">3</span>' +
  '<svg data-testid="stub-icon" class="w-3.5 h-3.5 text-[var(--accent)] shrink-0"></svg>' +
  '<div class="flex-1 min-w-0">' +
  '<h2 class="text-xs font-bold text-[var(--text-primary)] truncate">Test Title</h2>' +
  '<p class="text-[10px] text-[var(--text-muted)] truncate">Subtitle text</p>' +
  "</div></div>";

const BASELINE_BARE =
  '<div class="flex items-center gap-2 mb-2 pb-1.5 border-b border-[var(--border-default)]">' +
  '<svg data-testid="stub-icon" class="w-3.5 h-3.5 text-[var(--accent)] shrink-0"></svg>' +
  '<div class="flex-1 min-w-0">' +
  '<h2 class="text-xs font-bold text-[var(--text-primary)] truncate">Material</h2>' +
  "</div></div>";

describe("SectionHeader", () => {
  it("renders the icon, title, and optional subtitle", () => {
    render(
      <SectionHeader
        Icon={Wrench}
        title="Test Title"
        subtitle="Subtitle text"
      />,
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Subtitle text")).toBeInTheDocument();
    expect(document.querySelector(".lucide-wrench")).toBeInTheDocument();
  });

  it("does not render a section-local field customization control", () => {
    render(
      <>
        <SectionHeader Icon={Wrench} title="Material" />
        <SectionHeader Icon={Wrench} title="Print" />
        <SectionHeader Icon={Wrench} title="Sales" />
      </>,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByTitle("calc.customizeFields")).not.toBeInTheDocument();
  });

  it("keeps the no-metric markup byte-identical to the baseline (step + subtitle)", () => {
    const { container } = render(
      <SectionHeader
        Icon={stubIcon}
        title="Test Title"
        subtitle="Subtitle text"
        step={3}
      />,
    );

    expect(container.innerHTML).toBe(BASELINE_WITH_STEP);
  });

  it("keeps the no-metric markup byte-identical to the baseline (bare)", () => {
    const { container } = render(
      <SectionHeader Icon={stubIcon} title="Material" />,
    );

    expect(container.innerHTML).toBe(BASELINE_BARE);
  });

  it("renders the metric to the right of the title", () => {
    const { container } = render(
      <SectionHeader
        Icon={stubIcon}
        title="Test Title"
        subtitle="Subtitle text"
        step={3}
        metric={<span>Tempo Total: 5.0 h</span>}
      />,
      {},
    );

    const metric = screen.getByText("Tempo Total: 5.0 h");
    expect(metric).toBeInTheDocument();

    // The metric lives in its own justify-between row slot, last on the line,
    // so it sits at the heading's right edge. Hierarchy when `metric` exists:
    // div.justify-between > span (the slot wrapper) > the metric node — so the
    // slot is TWO levels up from the metric, not one (one level up is the
    // wrapper span).
    const wrapper = metric.parentElement;
    const slot = wrapper?.parentElement;
    expect(slot?.className).toContain("justify-between");
    expect(slot?.className).toContain("flex-1");
    expect(slot?.lastElementChild).toBe(wrapper);
    expect(wrapper).toContainElement(metric);

    // …and after the title in DOM order, never inside the heading itself.
    const title = screen.getByRole("heading", { level: 2 });
    expect(
      title.compareDocumentPosition(metric) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(title.contains(metric)).toBe(false);

    // The step badge / icon / title keep their places inside the new wrapper.
    expect(container.querySelector('[data-testid="step-badge"]')).toBeTruthy();
    expect(screen.getByTestId("stub-icon")).toBeTruthy();
  });
});
