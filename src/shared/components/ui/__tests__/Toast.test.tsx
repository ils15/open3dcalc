import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AA_NON_TEXT,
  AA_NORMAL_TEXT,
  compositeOver,
  contrastRatio,
  resolveTokenHex,
} from "../../../__tests__/helpers/contrast";
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

/**
 * The close control and the focus indicator, measured.
 *
 * Themis' review of the Toast fix was right that the message text was the only
 * thing being checked. Two things on this component were left unmeasured and
 * both were failing:
 *
 *  1. The close button carried `opacity-70`, so the glyph the user has to find
 *     to dismiss the toast rendered at 70% of the inherited ink over the fill.
 *     Over the danger fill that is 2.75:1 — and a control's visual indicator is
 *     a NON-TEXT contrast case, so the bar is WCAG 1.4.11's 3:1, not 1.4.3's
 *     4.5:1. The message text passing 1.4.3 said nothing about the button.
 *
 *  2. The focus ring was `focus-visible:ring-[var(--color-accent)]/50` with
 *     `focus-visible:outline-none`. In LIGHT theme `--color-accent` is #4f46e5
 *     and the info fill `--color-accent-fill` is ALSO #4f46e5, so a 50%-alpha
 *     ring composites to exactly the fill it sits on: 1.00:1. The indicator was
 *     not low-contrast, it was mathematically absent — and the browser's
 *     fallback outline, which would have shown, was explicitly removed. That
 *     combination is a keyboard trap: focus arrived and nothing was drawn.
 *
 * WHY THESE ARE MEASURED RATHER THAN ASSERTED AS CLASS NAMES
 * --------------------------------------------------------
 * Asserting `expect(button.className).toContain("ring-white")` would pass for a
 * class that never renders, at a size that renders nothing, or at an alpha that
 * cancels the fill. So every assertion below resolves the class string the DOM
 * actually has, through the same WCAG arithmetic the token guard uses, and
 * compares real ratios against a real threshold.
 *
 * THE WCAG MODEL, STATED
 * ----------------------
 *  - 1.4.11 Non-text Contrast requires >= 3:1 for "visual information required
 *    to identify user interface components and states". A close button's glyph
 *    and a focus indicator are both that: without them the control cannot be
 *    identified and focus cannot be seen. It is 3:1, not 4.5:1, because neither
 *    is text.
 *  - 1.4.11 is measured against the ADJACENT colour. For the close glyph and
 *    the inner focus ring the adjacent colour is the toast FILL they sit on.
 *  - A focus indicator that is removed from the page and re-added on top of an
 *    unknown backdrop cannot rely on one colour, so a two-tone indicator is
 *    modelled the way it is actually specified: it must be distinguishable
 *    from each neighbour by AT LEAST ONE of its tones, and the two tones must
 *    be distinguishable from EACH OTHER. A single tone is asserted to be
 *    impossible, so the sandwich cannot be quietly collapsed into one colour
 *    that fails somewhere.
 */
describe("Toast — close control and focus indicator meet non-text contrast", () => {
  const tokensCss = readFileSync(
    resolve(__dirname, "../../../../styles/tokens.css"),
    "utf-8",
  );

  /** The complete backdrop set, as in the call-site guard. */
  const SURFACES = [
    "surface-canvas",
    "surface-raised",
    "surface-overlay",
    "surface-sunken",
    "surface-input",
  ];

  const CASES = [
    { type: "error", fill: "color-danger-fill" },
    { type: "success", fill: "color-positive-fill" },
    { type: "info", fill: "color-accent-fill" },
  ] as const;

  interface Mounted {
    /** the `role="alert"` toast body, whose class carries the fill */
    body: HTMLElement;
    /** the close button, whose class carries the opacity and the ring */
    close: HTMLElement;
    /** the fill the body actually painted, as a token name */
    fillToken: string;
    fillHex: string;
    /**
     * The close glyph's effective alpha, from its `opacity-NN`, and the hover
     * alpha from `hover:opacity-NN`. Nullable ON PURPOSE: an absent utility is
     * a finding this block must report, not a value to default to 1. Defaulting
     * is what made the first version of the resting-state assertion measure
     * full opacity on a control that renders at 70%, and pass.
     */
    /** opacity utility on the BUTTON — must be absent, see the regression below */
    buttonAlpha: number | null;
    /** the GLYPH's opacity utility, which is where the de-emphasis belongs */
    iconAlpha: number | null;
    /** the GLYPH's hover opacity */
    hoverAlpha: number | null;
    /** the glyph element itself */
    glyph: SVGSVGElement;
    /** the focus ring colour, with its alpha, exactly as declared */
    ring: { token: string; hex: string; alpha: number };
    /** the ring's offset colour, or null when there is none */
    offset: { token: string; hex: string; alpha: number } | null;
  }

  /** `ring-[var(--x)]/NN`, or `ring-white`, on the close button. */
  /**
   * The `opacity-NN` utility on an element, or null when there is none.
   *
   * Per TOKEN and per ELEMENT. Both matter: matching a whole className with
   * `^…$` never fires for a utility in the middle of a long list, so the alpha
   * silently defaulted to 1 and a resting-state assertion measured full opacity
   * on a control that rendered at 70%. And it must be read off the element the
   * opacity actually applies to — an `opacity` on a button composites that
   * button's own focus-ring box-shadow down with it, so reading the button's
   * value and applying it only to the glyph understates the ring.
   */
  function alphaIn(className: string, prefix = ""): number | null {
    for (const raw of className.split(/\s+/).filter(Boolean)) {
      const m = raw.match(new RegExp(`^${prefix}opacity-(\\d{1,3})$`, "i"));
      if (m) return parseInt(m[1], 10) / 100;
    }
    return null;
  }

  function parseColour(
    className: string,
    property: "ring" | "ring-offset",
  ): { token: string; hex: string; alpha: number } | null {
    for (const raw of className.split(/\s+/).filter(Boolean)) {
      // TWO details, both of which made this parse nothing and report a 0%
      // sentinel — a red for the wrong reason, asserting against a value the
      // component never had:
      //   - Variant prefixes are stripped first, because `focus-visible:ring-…`
      //     IS the ring (same rule, and same reason, as the call-site guard).
      //   - The hyphen is part of the utility. `ring-[var(--x)]` is `ring` + `-`
      //     + `[…]`; omitting it matches neither the arbitrary-value COLOUR nor
      //     the numeric width `ring-2`, which is what made the colour invisible.
      let utility = raw;
      while (/^[a-z-]+:/.test(utility))
        utility = utility.slice(utility.indexOf(":") + 1);
      const m = utility.match(
        new RegExp(
          `^${property}-(?:\\[var\\(--([a-z0-9-]+)\\)\\])?(?:/(\\d{1,3}))?$`,
          "i",
        ),
      );
      if (!m) continue;
      const token = m[1] ?? "literal";
      const alpha = m[2] ? parseInt(m[2], 10) / 100 : 1;
      const hex = m[1] ? resolveTokenHex(tokensCss, "light", m[1]) : null;
      if (!hex) return null;
      return { token, hex, alpha };
    }
    return null;
  }

  function mount(type: (typeof CASES)[number]["type"]): Mounted {
    // Several `it.each` bodies call this more than once. Testing Library's
    // auto-cleanup runs between TESTS, not between renders inside one, so
    // without this the second mount finds every earlier toast still in the
    // document and `getByRole("alert")` throws on a duplicate.
    cleanup();
    render(
      <ToastContainer
        items={[{ id: 1, message: "msg", type }]}
        onDismiss={vi.fn()}
      />,
    );
    const body = screen.getByRole("alert");
    const close = screen.getByLabelText("Fechar");
    // One token in a long class list. Anchoring the match to the whole
    // className was wrong and made every assertion in this block fail on the
    // PARSER rather than on the component — a vacuous red that looked like a
    // real one.
    const fillMatch = body.className
      .split(/\s+/)
      .map((c) => c.match(/^bg-\[var\(--([a-z0-9-]+)\)\]$/i))
      .find((m): m is RegExpMatchArray => m !== null);
    if (!fillMatch) {
      throw new Error(
        `no bare var()-backed fill on the toast body: ${body.className}`,
      );
    }
    // The alpha comes from the GLYPH, not the button. `opacity` on the button
    // composites the element's own focus-ring shadows down with it, so reading
    // the button's opacity and applying it only to the glyph understated the
    // ring: it was measured at the raw token value while the browser painted it
    // 10% fainter. Themis caught that. The ring is now asserted against an
    // UNDIMMED button, and a separate regression fails if any opacity reappears
    // on the button or an ancestor.
    const glyph = close.querySelector<SVGSVGElement>("svg");
    if (!glyph) {
      throw new Error("the close control renders no glyph to measure");
    }
    const alphaOf = (prefix: string): number | null =>
      alphaIn(
        glyph.className.baseVal || glyph.getAttribute("class") || "",
        prefix,
      );
    const ring = parseColour(close.className, "ring");
    const offset = parseColour(close.className, "ring-offset");
    return {
      body,
      close,
      fillToken: fillMatch[1],
      fillHex: resolveTokenHex(tokensCss, "light", fillMatch[1])!,
      buttonAlpha: alphaIn(close.className),
      iconAlpha: alphaOf(""),
      hoverAlpha: alphaOf("hover:"),
      glyph,
      ring: ring ?? { token: "none", hex: "", alpha: 0 },
      offset,
    };
  }

  beforeEach(() => {
    vi.useRealTimers();
  });

  it.each(CASES)(
    "gives the $type close glyph >= 3:1 against its own fill, at rest and on hover",
    ({ type, fill }) => {
      const m = mount(type);
      expect(
        m.fillToken,
        `the ${type} toast must paint the expected fill`,
      ).toBe(fill);

      // The glyph inherits the toast's ink (the variant's own -fg) and is then
      // painted at the button's opacity over the fill. Both are real rendered
      // states, so both are measured — 1.4.11 applies to a state the user can
      // actually see, which is the same argument the wash guard makes for hover.
      for (const [label, alpha] of [
        ["rest", m.iconAlpha],
        ["hover", m.hoverAlpha],
      ] as const) {
        expect(
          alpha,
          `the ${type} close control declares no ${label} opacity, so this ` +
            `block cannot measure the state it claims to check`,
        ).not.toBeNull();
        const ink = resolveTokenHex(tokensCss, "light", `${fill}-fg`)!;
        const effective = compositeOver({ hex: ink, alpha: alpha! }, m.fillHex);
        const ratio = contrastRatio(effective, m.fillHex);
        expect(
          ratio,
          `the ${type} close glyph at ${label} is ${effective} over ` +
            `${m.fillHex} = ${ratio.toFixed(2)}:1. A control's indicator is a ` +
            `NON-TEXT case, so WCAG 1.4.11 requires >= ${AA_NON_TEXT}:1, not ` +
            `the ${AA_NORMAL_TEXT}:1 that applies to the message text.`,
        ).toBeGreaterThanOrEqual(AA_NON_TEXT);
      }
    },
  );

  it.each(CASES)(
    "paints a $type focus ring that is opaque and not the fill's own colour",
    ({ type }) => {
      const m = mount(type);
      expect(
        m.ring.alpha,
        `the ${type} focus ring is painted at ${(m.ring.alpha * 100).toFixed(0)}% ` +
          `alpha. A ring whose alpha lets the fill show through is not a ring: ` +
          `the shipped one composited to exactly its own fill (1.00:1) in light ` +
          `theme, because --color-accent and --color-accent-fill are both ` +
          `#4f46e5. An indicator must be opaque, or it must be measured as the ` +
          `composite — and a composite that cancels is not an indicator.`,
      ).toBe(1);
      expect(
        contrastRatio(m.ring.hex, m.fillHex),
        `the ${type} focus ring ${m.ring.hex} against its own fill ${m.fillHex} ` +
          `is below ${AA_NON_TEXT}:1, so focusing the close button draws nothing ` +
          `distinguishable (WCAG 1.4.11)`,
      ).toBeGreaterThanOrEqual(AA_NON_TEXT);
    },
  );

  it.each(CASES)(
    "keeps the $type focus indicator visible in BOTH themes, on fill and on surface",
    ({ type, fill }) => {
      const m = mount(type);
      // Two tones, because no single colour can do this job. Asserted here as a
      // property of the INDICATOR rather than of one class, which is the correct
      // model for a ring-plus-offset: the ring sits on the fill, the offset is
      // the only part that can meet a surface.
      expect(
        m.offset,
        `the ${type} close control has no ring offset. One colour cannot be 3:1 ` +
          `against both a dark fill and a light surface, and the offset tone is ` +
          `what carries the indicator past the toast's own edge.`,
      ).not.toBeNull();

      for (const theme of ["light", "dark"] as const) {
        const fillHex = resolveTokenHex(tokensCss, theme, fill)!;
        const ringHex = resolveTokenHex(tokensCss, theme, m.ring.token)!;
        const offsetHex = resolveTokenHex(tokensCss, theme, m.offset!.token)!;

        // 1. Against the fill the ring actually sits on.
        expect(
          contrastRatio(ringHex, fillHex),
          `${theme}: ${type} focus ring ${ringHex} on fill ${fillHex} (WCAG 1.4.11)`,
        ).toBeGreaterThanOrEqual(AA_NON_TEXT);

        // 2. The two tones must be told apart from each other, or the
        //    "indicator" is one ambiguous line.
        expect(
          contrastRatio(ringHex, offsetHex),
          `${theme}: the ${type} ring ${ringHex} and its offset ${offsetHex} are ` +
            `within ${AA_NON_TEXT}:1 — the indicator reads as one line, not a ` +
            `sandwich`,
        ).toBeGreaterThanOrEqual(AA_NON_TEXT);

        // 3. Against every surface the toast can sit on, AT LEAST ONE tone must
        //    clear 3:1. In light that is the offset; in dark it is the ring.
        for (const surface of SURFACES) {
          const surfaceHex = resolveTokenHex(tokensCss, theme, surface)!;
          const best = Math.max(
            contrastRatio(ringHex, surfaceHex),
            contrastRatio(offsetHex, surfaceHex),
          );
          expect(
            best,
            `${theme}: neither the ring ${ringHex} nor the offset ${offsetHex} ` +
              `reaches ${AA_NON_TEXT}:1 against --${surface} ${surfaceHex}, so ` +
              `the ${type} focus indicator is lost against the page`,
          ).toBeGreaterThanOrEqual(AA_NON_TEXT);
        }
      }
    },
  );

  it("carries NO opacity on the button or its ancestors, so the ring is not dimmed", () => {
    // The regression Themis asked for. `opacity` composites an element's own
    // box-shadow, and Tailwind paints the focus ring as a box-shadow, so an
    // `opacity-90` on the button made the focus INDICATOR 4.01:1 instead of the
    // 4.77:1 the ring token provides. It cleared 1.4.11, so nothing looked
    // broken — but the same property at the old 0.7 would have put the ring at
    // 2.75:1, i.e. the keyboard indicator below the bar, on the very control
    // that was already below it for the glyph. Asserted structurally so putting
    // the de-emphasis back where it was fails here rather than in a ratio.
    for (const { type } of CASES) {
      const m = mount(type);
      expect(
        m.buttonAlpha,
        `${type}: the close BUTTON has opacity-${(m.buttonAlpha ?? 0) * 100}, which ` +
          `composites the focus ring down with it. The de-emphasis belongs on ` +
          `the glyph, which is where it is now.`,
      ).toBeNull();

      // And no ancestor either, since a wrapper's opacity would dim the ring just
      // as effectively while looking innocent here.
      let node: HTMLElement | null = m.close.parentElement;
      let depth = 0;
      while (node && depth < 4) {
        expect(
          alphaIn(node.className),
          `${type}: an ANCESTOR of the close control has ` +
            `opacity-${(alphaIn(node.className) ?? 0) * 100}, which would dim the ` +
            `focus ring the same way (tag ${node.tagName}).`,
        ).toBeNull();
        node = node.parentElement;
        depth += 1;
      }
    }
  });

  it("keeps the glyph de-emphasised, so the de-emphasis was moved not dropped", () => {
    // The counterpart to the test above: the point was to move the opacity, not
    // to delete it. Without this, "no opacity anywhere" would pass while the
    // glyph sat at full strength and lost its hierarchy against the message.
    for (const { type } of CASES) {
      const m = mount(type);
      expect(
        m.iconAlpha,
        `${type}: the close glyph must stay de-emphasised; it is now the only ` +
          `thing carrying that hierarchy`,
      ).not.toBeNull();
      expect(
        m.iconAlpha,
        `${type}: the glyph's opacity must clear 1.4.11's 3:1, which is ` +
          `asserted as a ratio elsewhere — here only that it is a deliberate ` +
          `de-emphasis and not full strength`,
      ).toBeLessThan(1);
    }
  });

  it("cannot satisfy the indicator with a single colour, so the two tones stay", () => {
    // Guards the guard: if a future refactor drops the offset and keeps one
    // colour, this is the assertion that explains why that cannot work, rather
    // than a comment that gets deleted with the code.
    //
    // The requirement spans BOTH themes, and that is the whole point. Judged in
    // light theme alone the claim is false: #0a0b10 clears the accent fill
    // (3.13:1) and every light surface (17:1+), so a single dark ring would
    // pass a light-only check. It collapses on the dark canvas, where it is
    // 1.00:1. Any candidate must clear 3:1 against the fill it sits on AND
    // every surface, in both themes, or the two tones are load-bearing.
    const candidates = [
      "#ffffff",
      "#0a0b10",
      "#4f46e5",
      "#818cf8",
      "#111827",
      "#f1f5f9",
    ];
    const clears = candidates.filter((c) =>
      (["light", "dark"] as const).every((theme) => {
        const fill = resolveTokenHex(tokensCss, theme, "color-accent-fill")!;
        if (contrastRatio(c, fill) < AA_NON_TEXT) return false;
        return SURFACES.every(
          (s) =>
            contrastRatio(c, resolveTokenHex(tokensCss, theme, s)!) >=
            AA_NON_TEXT,
        );
      }),
    );
    expect(
      clears,
      "a single tone is expected to be impossible across both themes; if one " +
        "now works, the two-tone indicator may be simplifiable and this test " +
        "should be revisited",
    ).toHaveLength(0);
  });

  it("does not remove the browser outline without an opaque replacement", () => {
    // The shipped combination was `ring-…/50` AND `outline-none`: no indicator
    // and no fallback. Asserted directly so the pair cannot come back.
    for (const { type } of CASES) {
      const m = mount(type);
      const removesOutline = /(^|\s)focus-visible:outline-none(\s|$)/.test(
        m.close.className,
      );
      if (removesOutline) {
        expect(
          m.ring.alpha,
          `${type}: outline-none is set, so the focus ring is the ONLY indicator ` +
            `and it must be opaque — a translucent ring plus no outline leaves a ` +
            `keyboard user with no visible focus at all`,
        ).toBe(1);
      }
    }
  });

  it("keeps the close control's accessible name, activation and dismissal", () => {
    // The accessibility behaviour the measurement above must not have cost.
    const onDismiss = vi.fn();
    render(
      <ToastContainer
        items={[{ id: 7, message: "Export blocked", type: "info" }]}
        onDismiss={onDismiss}
      />,
    );
    const close = screen.getByRole("button", { name: "Fechar" });
    expect(close).toBeInTheDocument();
    expect(close.tagName).toBe("BUTTON");
    // Real activation, not a synthetic event: a native <button> responds to
    // Enter and Space without a keydown handler, and that is the property.
    fireEvent.click(close);
    expect(onDismiss).toHaveBeenCalledWith(7);
  });

  it.each(CASES)(
    "still renders all three $type variants distinctly",
    ({ type }) => {
      const m = mount(type);
      expect(m.body.className).toContain("animate-slide-left");
      expect(m.close.className).toContain("focus-visible:ring");
    },
  );
});
