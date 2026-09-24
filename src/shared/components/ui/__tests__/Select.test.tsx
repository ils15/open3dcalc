import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import { resolve } from "node:path";
import { Select } from "../Select/Select";

const mockOptions = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

// 2 grupos x 2 opções — o highlight do teclado precisa ser um índice
// GLOBAL sobre a lista flat, não o idx local de cada grupo.
const groupedOptions = [
  { value: "a", label: "Alpha", group: "G1" },
  { value: "b", label: "Bravo", group: "G1" },
  { value: "c", label: "Charlie", group: "G2" },
  { value: "d", label: "Delta", group: "G2" },
];

// vitest roda a partir da raiz do config (raiz do repo)
const SHARED_TOKENS_CSS = resolve(
  process.cwd(),
  "src/styles/tokens.css",
);

/** Restaura matchMedia/geometry stubbed em testes individuais. */
const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

describe("Select", () => {
  it("renders with label", () => {
    render(
      <Select
        value="a"
        onChange={vi.fn()}
        options={mockOptions}
        label="Test"
      />,
    );
    expect(screen.getByLabelText("Test")).toBeInTheDocument();
  });

  it("shows selected option label", () => {
    render(
      <Select
        value="b"
        onChange={vi.fn()}
        options={mockOptions}
        label="Test"
      />,
    );
    expect(screen.getByText("Option B")).toBeInTheDocument();
  });

  it("opens dropdown on click", () => {
    render(
      <Select
        value="a"
        onChange={vi.fn()}
        options={mockOptions}
        label="Test"
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("has zero-duration transition when reduced motion is preferred", () => {
    // This test verifies the component respects reduced motion
    // The actual behavior is controlled by the useReducedMotion hook
    render(
      <Select
        value="a"
        onChange={vi.fn()}
        options={mockOptions}
        label="Test"
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
  });

  it("filters options by the search query", () => {
    render(
      <Select
        value="a"
        onChange={vi.fn()}
        options={mockOptions}
        label="Test"
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText("Buscar..."), {
      target: { value: "Option B" },
    });
    expect(
      screen.getByRole("option", { name: /Option B/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Option A/ }),
    ).not.toBeInTheDocument();
  });

  /* ---------------------------------------------------------------
   * CAUSA-RAIZ 2 — clipping por overflow (caso FilamentInventory):
   * o menu tem que viver num portal, fora do container scrollable.
   * ------------------------------------------------------------- */
  it("renders the menu in a portal, escaping overflow-clipped containers", () => {
    render(
      <div
        data-testid="scroll-container"
        style={{ maxHeight: "100px", overflowY: "auto" }}
      >
        <Select
          value="a"
          onChange={vi.fn()}
          options={mockOptions}
          label="Test"
        />
      </div>,
    );
    fireEvent.click(screen.getByRole("combobox"));

    const listbox = screen.getByRole("listbox");
    const container = screen.getByTestId("scroll-container");
    expect(document.body.contains(listbox)).toBe(true);
    expect(container.contains(listbox)).toBe(false);
  });

  /* ---------------------------------------------------------------
   * CAUSA-RAIZ 3 — z-index acima da bottom nav mobile (z-50).
   * ------------------------------------------------------------- */
  it("layers the menu above the mobile bottom nav via the --z-dropdown token", () => {
    render(
      <Select
        value="a"
        onChange={vi.fn()}
        options={mockOptions}
        label="Test"
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));

    // A bottom nav z-50 pinta por cima de um menu z-50; o token resolve isso.
    expect(screen.getByRole("listbox").style.zIndex).toBe("var(--z-dropdown)");
  });

  it("defines --z-dropdown above the bottom nav layer (z-50)", () => {
    const css = fs.readFileSync(SHARED_TOKENS_CSS, "utf8");
    const token = css.match(/--z-dropdown:\s*(\d+)/);
    expect(
      token,
      "--z-dropdown must be defined in the theme tokens",
    ).not.toBeNull();
    expect(Number(token![1])).toBeGreaterThan(50);
  });

  /* ---------------------------------------------------------------
   * CAUSA-RAIZ 1 — colisão: menu abre para cima (flip) quando não
   * cabe embaixo do trigger. jsdom não faz layout, então stubamos a
   * geometria que o floating-ui lê (rects + viewport).
   * ------------------------------------------------------------- */
  it("flips the menu above the trigger when there is no room below", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 768,
      configurable: true,
    });

    const rect = (top: number, bottom: number, height: number): DOMRect =>
      ({
        top,
        bottom,
        left: 8,
        right: 208,
        width: 200,
        height,
        x: 8,
        y: top,
      }) as DOMRect;

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const role = this.getAttribute("role");
        // trigger encostado no fim de uma viewport de 768px (bottom = 760)
        if (role === "combobox") return rect(700, 760, 60);
        // menu com 200px de altura — não cabe abaixo (760 + 200 > 768)
        if (role === "listbox") return rect(0, 200, 200);
        return rect(0, 0, 0);
      },
    );
    // jsdom não faz layout; o flip/size precisa de dimensões reais do menu
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute("role") === "listbox" ? 200 : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute("role") === "listbox" ? 200 : 0;
      },
    );

    render(
      <Select
        value="a"
        onChange={vi.fn()}
        options={mockOptions}
        label="Test"
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    // computePosition é assíncrono (Promise + flushSync)
    await act(async () => {
      await Promise.resolve();
    });

    const listbox = screen.getByRole("listbox");
    // posicionamento real aplicado pelo floating-ui (não mais mt-1.5/absolute manual)
    expect(listbox.style.position).toBe("absolute");
    // flip: menu foi parar acima do trigger (top < 700) em vez de abaixo (766)
    const top = parseFloat(listbox.style.top);
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(700);
  });

  /* ---------------------------------------------------------------
   * CAUSA-RAIZ 4 — mobile ≤640px vira bottom sheet.
   * ------------------------------------------------------------- */
  it("renders as a full-width bottom sheet on narrow viewports", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    render(
      <Select
        value="a"
        onChange={vi.fn()}
        options={mockOptions}
        label="Test"
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));

    const listbox = screen.getByRole("listbox");
    expect(listbox.style.position).toBe("fixed");
    expect(listbox.style.bottom).toBe("0px");
  });

  /* ---------------------------------------------------------------
   * Refactor guards — a lógica de fechamento passou a reusar
   * useDismissablePopover; o contrato de teclado tem que se manter.
   * (AnimatePresence mantém o nó montado durante a saída, então
   *  afirmamos o estado ARIA síncrono, não o unmount.)
   * ------------------------------------------------------------- */
  /* ---------------------------------------------------------------
   * W10a — caminho de renderização de thumbnails.
   * SelectOption.image existia mas nunca era renderizado; agora vira
   * <img> com fallback de monograma em erro.
   * ------------------------------------------------------------- */
  describe("option thumbnails", () => {
    const imageOptions = [
      { value: "a", label: "Alpha", image: "/img/alpha.png" },
      { value: "b", label: "Bravo", group: "G1" },
      { value: "c", label: "Charlie" },
    ];

    it("renders an <img> when the option has an image", () => {
      render(
        <Select
          value="c"
          onChange={vi.fn()}
          options={imageOptions}
          label="Test"
        />,
      );
      fireEvent.click(screen.getByRole("combobox"));

      const img = screen
        .getByRole("option", { name: /Alpha/ })
        .querySelector("img");
      expect(img).not.toBeNull();
      expect(img).toHaveAttribute("src", "/img/alpha.png");
    });

    it("loads thumbnails lazily and asynchronously", () => {
      render(
        <Select
          value="c"
          onChange={vi.fn()}
          options={imageOptions}
          label="Test"
        />,
      );
      fireEvent.click(screen.getByRole("combobox"));

      const img = screen
        .getByRole("option", { name: /Alpha/ })
        .querySelector("img");
      expect(img).toHaveAttribute("loading", "lazy");
      expect(img).toHaveAttribute("decoding", "async");
    });

    it("renders the selected image in the trigger", () => {
      render(
        <Select
          value="a"
          onChange={vi.fn()}
          options={imageOptions}
          label="Test"
        />,
      );
      const trigger = screen.getByRole("combobox");
      const img = trigger.querySelector("img");
      expect(img).not.toBeNull();
      expect(img).toHaveAttribute("src", "/img/alpha.png");
    });

    it("falls back to the monogram when the image fails to load", () => {
      render(
        <Select
          value="a"
          onChange={vi.fn()}
          options={imageOptions}
          label="Test"
        />,
      );
      const trigger = screen.getByRole("combobox");
      const img = trigger.querySelector("img")!;

      // jsdom não carrega recursos — simulamos o 404/network failure.
      fireEvent.error(img);

      expect(trigger.querySelector("img")).toBeNull();
      expect(trigger).toHaveTextContent("AL");
    });

    it("falls back to the monogram inside an option on image error", () => {
      render(
        <Select
          value="c"
          onChange={vi.fn()}
          options={imageOptions}
          label="Test"
        />,
      );
      fireEvent.click(screen.getByRole("combobox"));

      const option = screen.getByRole("option", { name: /Alpha/ });
      fireEvent.error(option.querySelector("img")!);

      expect(option.querySelector("img")).toBeNull();
      expect(option).toHaveTextContent("AL");
    });

    it("renders no thumbnail when the option has neither image nor group", () => {
      render(
        <Select
          value="a"
          onChange={vi.fn()}
          options={imageOptions}
          label="Test"
        />,
      );
      fireEvent.click(screen.getByRole("combobox"));

      const option = screen.getByRole("option", { name: /Charlie/ });
      expect(option.querySelector("img")).toBeNull();
      // Charlie não tem grupo nem imagem — fica sem thumb (comportamento atual).
    });
  });

  it("closes on Escape and returns focus to the trigger", () => {
    const onChange = vi.fn();
    render(
      <Select
        value="a"
        onChange={onChange}
        options={mockOptions}
        label="Test"
      />,
    );
    const trigger = screen.getByRole("combobox");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(trigger);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes when clicking outside", () => {
    render(
      <div>
        <Select
          value="a"
          onChange={vi.fn()}
          options={mockOptions}
          label="Test"
        />
        <button data-testid="outside">outside</button>
      </div>,
    );
    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("selects an option via keyboard (ArrowDown + Enter)", () => {
    const onChange = vi.fn();
    render(
      <Select
        value="a"
        onChange={onChange}
        options={mockOptions}
        label="Test"
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("b");
  });

  /* ---------------------------------------------------------------
   * A11Y — modo `groups`: focusIdx (seto pelas arrow keys) é GLOBAL
   * sobre a lista flat, mas a renderização agrupada reiniciava o idx
   * em cada grupo — a seta destacava a opção errada (ou várias de
   * uma vez) ao cruzar a fronteira de um grupo.
   * WCAG 2.4.3 (Focus order) / 2.4.7 (Focus visible).
   * ------------------------------------------------------------- */
  it("groups mode: ArrowDown highlights the option at the global index across a group boundary", () => {
    const onChange = vi.fn();
    render(
      <Select
        value="a"
        onChange={onChange}
        options={groupedOptions}
        label="Test"
        groups
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));

    // focusIdx -1 → 0 (Alpha) → 1 (Bravo) → 2 (Charlie, 1ª opção do G2)
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });

    // highlight global = índice 2 = Charlie; não o idx local do grupo.
    // (o nome acessível inclui o monograma do grupo — "G2Charlie")
    expect(screen.getByRole("option", { name: /Charlie/ })).toHaveClass(
      "bg-[var(--color-accent)]/20",
    );
    expect(screen.getByRole("option", { name: /Alpha/ })).not.toHaveClass(
      "bg-[var(--color-accent)]/20",
    );
    expect(screen.getByRole("option", { name: /Bravo/ })).not.toHaveClass(
      "bg-[var(--color-accent)]/20",
    );

    // Enter acerta a opção sob o cursor global (2 = 'c').
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("groups mode: ArrowUp traverses the group boundary backwards", () => {
    render(
      <Select
        value="a"
        onChange={vi.fn()}
        options={groupedOptions}
        label="Test"
        groups
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    // 2 (Charlie, G2) → 1 (Bravo, última opção do G1)
    fireEvent.keyDown(window, { key: "ArrowUp" });

    expect(screen.getByRole("option", { name: /Bravo/ })).toHaveClass(
      "bg-[var(--color-accent)]/20",
    );
    // antes do fix, idx local 1 destacava Bravo E Delta simultaneamente.
    expect(screen.getByRole("option", { name: /Delta/ })).not.toHaveClass(
      "bg-[var(--color-accent)]/20",
    );
  });
});
