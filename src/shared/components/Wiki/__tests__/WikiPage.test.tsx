import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import i18n from "@/shared/i18n/i18n";
import type { WikiBundle } from "@/shared/lib/wiki/loadWikiBundle";
import { WikiPage } from "../WikiPage";

// Same seam as useWikiNamespace.test.tsx: the bundle loader is mocked so this
// file exercises the UI contract against REAL i18n (skeleton -> content, nav,
// TOC, language switch), while loadWikiBundle.test.ts covers the assembly.
const { loadWikiBundleMock } = vi.hoisted(() => ({
  loadWikiBundleMock: vi.fn(),
}));

// jsdom has no layout engine, so scrollIntoView is absent — the cross-article
// handler calls it the moment the target heading resolves. Install the same
// no-op the tutorial tests use (src/shared/components/ui/__tests__/
// tutorialTours.test.tsx) before any wiki renders.
Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

vi.mock("@/shared/lib/wiki/loadWikiBundle", () => ({
  WIKI_NAMESPACE: "wiki",
  loadWikiBundle: loadWikiBundleMock,
}));

const PT_BR_BUNDLE: WikiBundle = {
  // order is inverted on purpose: the nav and the default selection must come
  // from `frontmatter.order`, not from the key order of the bundle.
  calculadora: {
    title: "Calculadora",
    order: 2,
    toc: [
      { depth: 1, text: "Calculadora", slug: "user-content-calculadora" },
      {
        depth: 2,
        text: "Níveis básico e avançado",
        slug: "user-content-niveis",
      },
    ],
    html: '<h1 id="user-content-calculadora">Calculadora</h1><p>A <strong>Calculadora</strong> é o núcleo.</p><h2 id="user-content-niveis">Níveis básico e avançado</h2><p>Dois níveis.</p>',
  },
  inventario: {
    title: "Inventário",
    order: 1,
    toc: [{ depth: 1, text: "Inventário", slug: "user-content-inventario" }],
    // The three cross-article shapes the handler must distinguish: a link to
    // a heading of ANOTHER article (niveis belongs to calculadora), a link to
    // a heading of THIS article, and an id no article owns (external/broken).
    html: '<h1 id="user-content-inventario">Inventário</h1><p>Filamentos cadastrados.</p><p>Veja <a href="#user-content-niveis">os níveis</a> da calculadora, o <a href="#user-content-inventario">topo</a> e um <a href="#user-content-inexistente">link quebrado</a>.</p>',
  },
  notas: {
    title: "Notas",
    order: 3,
    toc: [],
    html: "<p>Sem headings, só corpo.</p>",
  },
};

const EN_US_BUNDLE: WikiBundle = {
  calculadora: {
    title: "Calculator",
    order: 2,
    toc: [{ depth: 1, text: "Calculator", slug: "user-content-calculator" }],
    html: '<h1 id="user-content-calculator">Calculator</h1><p>The core.</p>',
  },
  inventario: {
    title: "Inventory",
    order: 1,
    toc: [{ depth: 1, text: "Inventory", slug: "user-content-inventory" }],
    html: '<h1 id="user-content-inventory">Inventory</h1><p>Filaments.</p>',
  },
};

const SUPPORTED = ["pt-BR", "en-US"];

describe("WikiPage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    loadWikiBundleMock.mockImplementation(async (locale: string) =>
      locale === "en-US" ? EN_US_BUNDLE : PT_BR_BUNDLE,
    );
    for (const lng of SUPPORTED) i18n.removeResourceBundle(lng, "wiki");
    await i18n.changeLanguage("pt-BR");
  });

  afterEach(async () => {
    for (const lng of SUPPORTED) i18n.removeResourceBundle(lng, "wiki");
    await i18n.changeLanguage("pt-BR");
  });

  it("renders a skeleton until the wiki namespace resolves", () => {
    // Never settles until we say so: the skeleton is the pre-ready state.
    loadWikiBundleMock.mockImplementation(
      () => new Promise(() => undefined),
    );

    render(<WikiPage />);

    expect(screen.getByTestId("wiki-skeleton")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Inventário" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Filamentos cadastrados.")).not.toBeInTheDocument();
  });

  it("renders the first article by frontmatter order once ready", async () => {
    render(<WikiPage />);

    // inventario has order 1, so it is the default selection.
    await waitFor(() =>
      expect(screen.getByText("Filamentos cadastrados.")).toBeInTheDocument(),
    );

    const inventarioButton = screen.getByRole("button", { name: "Inventário" });
    expect(inventarioButton).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: "Calculadora" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("switches the active article when a nav item is clicked", async () => {
    render(<WikiPage />);
    await waitFor(() =>
      expect(screen.getByText("Filamentos cadastrados.")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Calculadora" }));

    // The article body is the bundle's build-time html, verbatim.
    expect(screen.getByText("Dois níveis.")).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => {
        return element?.tagName === "STRONG" && content === "Calculadora";
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Filamentos cadastrados."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Calculadora" }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: "Inventário" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("renders the table of contents of the active article", async () => {
    render(<WikiPage />);
    await waitFor(() =>
      expect(screen.getByText("Filamentos cadastrados.")).toBeInTheDocument(),
    );

    // inventario has a single heading; its anchor is the rehype-slug id.
    const inventoryLink = screen.getByRole("link", { name: "Inventário" });
    expect(inventoryLink).toHaveAttribute(
      "href",
      "#user-content-inventario",
    );

    fireEvent.click(screen.getByRole("button", { name: "Calculadora" }));

    // calculadora has two headings, both in the TOC with their own anchors.
    expect(
      screen.getByRole("link", { name: "Calculadora" }),
    ).toHaveAttribute("href", "#user-content-calculadora");
    expect(
      screen.getByRole("link", { name: "Níveis básico e avançado" }),
    ).toHaveAttribute("href", "#user-content-niveis");
  });

  it("renders an article without a table of contents when it has no headings", async () => {
    render(<WikiPage />);
    await waitFor(() =>
      expect(screen.getByText("Filamentos cadastrados.")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Notas" }));

    expect(screen.getByText("Sem headings, só corpo.")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Sumário" }),
    ).not.toBeInTheDocument();
  });

  it("keeps showing content when the language changes (ready never dips)", async () => {
    render(<WikiPage />);
    await waitFor(() =>
      expect(screen.getByText("Filamentos cadastrados.")).toBeInTheDocument(),
    );

    await i18n.changeLanguage("en-US");

    // The new locale's bundle replaces the article content without a flash of
    // raw keys: ready stays true and the nav follows the new language.
    await waitFor(() =>
      expect(screen.getByText("Filaments.")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Inventory" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Inventário" }),
    ).not.toBeInTheDocument();
  });

  it("selects the article that owns a cross-article anchor when it is clicked", async () => {
    render(<WikiPage />);
    await waitFor(() =>
      expect(screen.getByText("Filamentos cadastrados.")).toBeInTheDocument(),
    );

    // "os níveis" points at #user-content-niveis, a heading of CALCULADORA —
    // not of the article currently on screen (inventario).
    fireEvent.click(screen.getByRole("link", { name: "os níveis" }));

    // The owner article is selected: its nav button is aria-current and its
    // content replaces the previous article.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Calculadora" }),
      ).toHaveAttribute("aria-current", "true"),
    );
    expect(screen.getByText("Dois níveis.")).toBeInTheDocument();
    expect(
      screen.queryByText("Filamentos cadastrados."),
    ).not.toBeInTheDocument();

    // The target heading is scrolled into view and receives focus (headings
    // are not focusable by default, so the handler makes them a tab stop).
    await waitFor(() => {
      const target = document.getElementById("user-content-niveis");
      expect(target).not.toBeNull();
      expect(target).toHaveFocus();
    });
  });

  it("keeps the current article when an anchor of the same article is clicked", async () => {
    render(<WikiPage />);
    await waitFor(() =>
      expect(screen.getByText("Filamentos cadastrados.")).toBeInTheDocument(),
    );

    // "topo" points at #user-content-inventario — a heading of the CURRENT
    // article, so this is the browser's own in-page scroll, not a switch.
    fireEvent.click(screen.getByRole("link", { name: "topo" }));

    expect(
      screen.getByRole("button", { name: "Inventário" }),
    ).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Filamentos cadastrados.")).toBeInTheDocument();
    expect(screen.queryByText("Dois níveis.")).not.toBeInTheDocument();
  });

  it("does not navigate when the clicked anchor is unknown", async () => {
    render(<WikiPage />);
    await waitFor(() =>
      expect(screen.getByText("Filamentos cadastrados.")).toBeInTheDocument(),
    );

    // #user-content-inexistente is owned by no article: the handler must
    // swallow it rather than break the page or hop articles.
    fireEvent.click(screen.getByRole("link", { name: "link quebrado" }));

    expect(
      screen.getByRole("button", { name: "Inventário" }),
    ).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Filamentos cadastrados.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Calculadora" }),
    ).not.toHaveAttribute("aria-current");
  });
});
