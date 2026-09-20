import { describe, it, expect } from "vitest";

import { markdownToHtml } from "@/shared/lib/wiki/markdownToHtml";

describe("markdownToHtml", () => {
  it("converts ATX headings h1-h3 with stable slug ids", () => {
    const { html } = markdownToHtml(`---
title: Calculadora
order: 3
---

# Visão geral
## Custo de material
### Filamento
`);

    expect(html).toContain('<h1 id="');
    expect(html).toContain("Visão geral</h1>");
    expect(html).toContain("Custo de material</h2>");
    expect(html).toContain("Filamento</h3>");
  });

  it("produces identical ids for identical input", () => {
    const md = `---
title: Estável
order: 1
---

# Mesmo título
`;

    const first = markdownToHtml(md);
    const second = markdownToHtml(md);

    expect(first.html).toBe(second.html);
    expect(first.toc).toEqual(second.toc);
  });

  it("disambiguates repeated headings", () => {
    const { toc } = markdownToHtml(`---
title: Duplicado
order: 1
---

# Seção
# Seção
# Seção
`);

    expect(toc.map((item) => item.slug)).toEqual([
      "user-content-seção",
      "user-content-seção-1",
      "user-content-seção-2",
    ]);
  });

  it("converts ordered and unordered lists", () => {
    const { html } = markdownToHtml(`---
title: Listas
order: 1
---

- PLA
- PETG

1. Primeiro
2. Segundo
`);

    expect(html).toContain("<ul>\n<li>PLA</li>\n<li>PETG</li>\n</ul>");
    expect(html).toContain("<ol>\n<li>Primeiro</li>\n<li>Segundo</li>\n</ol>");
  });

  it("converts fenced code blocks into pre/code", () => {
    const { html } = markdownToHtml(`---
title: Código
order: 1
---

\`\`\`ts
const price: number = 1;
\`\`\`
`);

    expect(html).toContain("<pre><code");
    expect(html).toContain("const price: number = 1;");
    expect(html).toContain('class="language-ts"');
  });

  it("converts links, bold and inline code", () => {
    const { html } = markdownToHtml(`---
title: Inline
order: 1
---

Use **negrito**, \`código inline\` e veja [o guia](https://example.com/guia).
`);

    expect(html).toContain("<strong>negrito</strong>");
    expect(html).toContain("<code>código inline</code>");
    expect(html).toContain(
      '<a href="https://example.com/guia">o guia</a>',
    );
  });

  it("parses required frontmatter and an optional tourId", () => {
    const { frontmatter } = markdownToHtml(`---
title: Clientes
order: 7
tourId: orcamentos-clientes
---

# Clientes
`);

    expect(frontmatter).toEqual({
      title: "Clientes",
      order: 7,
      tourId: "orcamentos-clientes",
    });
  });

  it("omits tourId from the frontmatter when it is absent", () => {
    const { frontmatter } = markdownToHtml(`---
title: Sem tour
order: 2
---

# Sem tour
`);

    expect(frontmatter).toEqual({ title: "Sem tour", order: 2 });
    expect(frontmatter.tourId).toBeUndefined();
  });

  it("reads quoted frontmatter values containing colons", () => {
    const { frontmatter } = markdownToHtml(`---
title: "Cálculo: visão geral"
order: 1
---

# Título
`);

    expect(frontmatter.title).toBe("Cálculo: visão geral");
  });

  it("builds the table of contents from headings in order", () => {
    const { toc } = markdownToHtml(`---
title: Índice
order: 1
---

# Introdução
## Primeiro passo
## Segundo passo
### Detalhe
# Encerramento
`);

    // rehype-slug prefixes ids (GitHub-style collision guard); anchors and
    // toc slugs always match because both come from the same heading id.
    expect(toc).toEqual([
      { depth: 1, text: "Introdução", slug: "user-content-introdução" },
      {
        depth: 2,
        text: "Primeiro passo",
        slug: "user-content-primeiro-passo",
      },
      {
        depth: 2,
        text: "Segundo passo",
        slug: "user-content-segundo-passo",
      },
      { depth: 3, text: "Detalhe", slug: "user-content-detalhe" },
      {
        depth: 1,
        text: "Encerramento",
        slug: "user-content-encerramento",
      },
    ]);
  });

  it("keeps toc slugs in sync with the heading anchors", () => {
    const { html, toc } = markdownToHtml(`---
title: Âncoras
order: 1
---

## Cabeçalho âncora
`);

    expect(toc).toHaveLength(1);
    expect(html).toContain(`id="${toc[0].slug}"`);
  });

  it("flattens markup inside headings when building the toc text", () => {
    const { toc } = markdownToHtml(`---
title: Texto
order: 1
---

## Custo **de** material
`);

    expect(toc[0].text).toBe("Custo de material");
  });

  it("ignores h4+ in the table of contents", () => {
    const { toc } = markdownToHtml(`---
title: Profundidade
order: 1
---

### Razoável
#### Profundo demais
`);

    expect(toc.map((item) => item.text)).toEqual(["Razoável"]);
  });

  it("drops script tags so they never reach the rendered article", () => {
    const { html } = markdownToHtml(`---
title: Seguro
order: 1
---

Texto antes.

<script>alert("xss")</script>

Texto depois.
`);

    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(");
    expect(html).toContain("Texto antes.");
    expect(html).toContain("Texto depois.");
  });

  it("drops raw HTML images with inline event handlers", () => {
    const { html } = markdownToHtml(`---
title: Imagem
order: 1
---

<img src="x" onerror="alert(1)">
`);

    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
  });

  it("strips unsafe link protocols so they cannot navigate", () => {
    const { html } = markdownToHtml(`---
title: Link
order: 1
---

[clique aqui](javascript:alert(1))
`);

    expect(html).not.toContain('href="javascript');
    expect(html).not.toContain("alert(");
  });

  it("throws when frontmatter is missing entirely", () => {
    expect(() => markdownToHtml("# Sem frontmatter\n")).toThrow(
      /missing YAML frontmatter/,
    );
  });

  it("throws when title is missing", () => {
    expect(() =>
      markdownToHtml(`---
order: 1
---

# Sem título
`),
    ).toThrow(/'title' is required/);
  });

  it("throws when order is missing", () => {
    expect(() =>
      markdownToHtml(`---
title: Sem ordem
---

# Sem ordem
`),
    ).toThrow(/'order' is required/);
  });

  it("throws on an unknown frontmatter key", () => {
    expect(() =>
      markdownToHtml(`---
title: Desconhecido
order: 1
author: Alguém
---

# Desconhecido
`),
    ).toThrow(/unknown key "author"/);
  });

  it("throws on a malformed frontmatter line", () => {
    expect(() =>
      markdownToHtml(`---
title: Malformado
order: 1
texto solto
---

# Malformado
`),
    ).toThrow(/not a "key: value" pair/);
  });

  it("treats an article with no headings as an empty table of contents", () => {
    const { toc, html } = markdownToHtml(`---
title: Plano
order: 1
---

Apenas um parágrafo, sem cabeçalhos.
`);

    expect(toc).toEqual([]);
    expect(html).toContain("Apenas um parágrafo, sem cabeçalhos.");
  });
});
