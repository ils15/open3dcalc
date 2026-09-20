# Wiki do Open3DCalc — guia do contribuidor

A aba **Wiki** é a documentação dentro do app: artigos em markdown que o usuário
lê offline, sem sair da calculadora. Este arquivo é o contrato de autoria desses
artigos — o que o markdown suporta, o que o frontmatter precisa ter e por que o
parse acontece em **build time** e nunca no client.

> Resumo para quem só quer escrever: crie
> `docs/wiki/pt-BR/<slug>.md` **e** `docs/wiki/en-US/<slug>.md` com o mesmo
> `<slug>` e o mesmo `order`, preencha o frontmatter abaixo e está pronto. O
> resto deste documento explica por que cada uma dessas regras existe e o que
> quebra quando ela é ignorada.

## Onde os artigos vivem

```
docs/wiki/
├── README.md              ← este guia (NÃO é um artigo)
├── pt-BR/
│   ├── calculadora.md
│   ├── inventario.md
│   └── orcamentos.md
└── en-US/
    ├── calculadora.md
    ├── inventario.md
    └── orcamentos.md
```

O `<slug>` **é o nome do arquivo** (sem a extensão, e com o subcaminho inteiro
preservado caso esteja em subpasta). Ele vira a chave do artigo no namespace do
i18n e o id de âncora dos títulos, então é dele que depende tudo o que segue.

> Apenas arquivos **dentro de `docs/wiki/<locale>/`** são artigos. O glob do
> registro exige esse segmento de locale (`docs/wiki/*/**/*.md`), então este
> `README.md` — e qualquer outro markdown solto na raiz de `docs/wiki/` — é
> ignorado tanto pelo plugin quanto pelo glob.

## Frontmatter — schema flat e obrigatório

Todo artigo começa com um bloco YAML **plano** (sem aninhamento, sem arrays):

```yaml
---
title: Calculadora
order: 1
tourId: calc-basico
---
```

| Chave   | Tipo   | Obrigatório | Para quê serve                              |
| ------- | ------ | ----------- | ------------------------------------------- |
| `title` | string | **sim**     | Rótulo do artigo no índice da Wiki (nav)    |
| `order` | number | **sim**     | Posição no índice; menor aparece primeiro   |
| `tourId`| string | não         | Tour de tutorial que este artigo introduz   |

O parser (`src/shared/lib/wiki/markdownToHtml.ts`, função `parseFrontmatter`)
é **fail-closed de propósito**: ele não é um parser de YAML genérico, e tudo o
que sai do documento abaixo faz o **build falhar apontando a linha exata**:

- chave desconhecida — `wiki frontmatter: line 3 uses unknown key "draft";
  supported keys are title, order and tourId`;
- linha sem `chave: valor` — `wiki frontmatter: line 4 is not a "key: value"
  pair: ...`;
- valor vazio — `wiki frontmatter: line 2 has an empty value; ...`;
- chave com formato inválido (ex.: começa com dígito) — `... has an invalid
  key: ...`;
- bloco de frontmatter ausente, `title` vazio ou `order` não numérico — a
  mensagem diz qual dos dois está faltando;
- `tourId` presente mas vazio — deve ser uma string não-vazia ou omitido.

Valores numéricos só aceitam decerais puros (`order: 3`, `order: 2.5`); `1_000`
e `Infinity` não são lidos como número. Aspas simples ou duplas são respeitadas
quando o valor tiver caracteres especiais.

## Subset de markdown suportado

A pipeline é `remark-parse` → `remark-frontmatter` → `remark-rehype` →
`rehype-slug` → `rehype-sanitize` → `rehype-stringify`. O que chega ao usuário
é o resultado dessa sequência:

| Sintaxe                | Suporte | Observação                                            |
| ---------------------- | ------- | ----------------------------------------------------- |
| Títulos ATX `#`–`###`  | ✅      | h1, h2 e h3 entram no **sumário** (TOC) lateral       |
| Títulos `####` e além  | ⚠️      | Renderizam, mas **não entram no TOC**                 |
| Listas ordenadas       | ✅      |                                                       |
| Listas não-ordenadas   | ✅      |                                                       |
| Blocos de código (```) | ✅      | Sem highlight de sintaxe (sem runtime, sem tema)     |
| Links `[a](b)`         | ✅      | Sanitizados; âncoras internas no formato `#user-content-<id>` (veja abaixo) |
| **Negrito**            | ✅      |                                                       |
| `código inline`        | ✅      |                                                       |
| HTML cru               | ❌      | Descartado pelo remark-rehype / rehype-sanitize       |

IDs estáveis para as âncoras vêm do `rehype-slug`, mas **não do nome do
arquivo**: o id é derivado do **texto do título** pelo `github-slugger`
(minúsculas, espaços viram `-`, `&` vira separador — logo "Operacional &
Software" gera `operacional--software` — e acentos **são preservados**:
"Custos da Máquina" vira `custos-da-máquina`). O TOC do artigo é montado a
partir dos h1–h3 em ordem de aparição, com a indentação por profundidade.
Por isso **use os títulos na ordem**: um `##` antes do `#` produz um sumário
"órfão" sem âncora raiz.

> **Não confunda slug do arquivo com id de âncora.** Um link para outro artigo
> deve apontar para o id do **H1 dele**, não para o nome do arquivo. Em
> `machine.md` o H1 é "Custos da Máquina", então o link correto é
> `[máquina](#user-content-custos-da-máquina)` — `#user-content-machine`
> **não existe**. Como os H1 são traduzidos, os ids diferem por locale ("Machine
> Costs" → `machine-costs`), então cada locale precisa dos seus próprios
> anchors. (No HTML final o `href` é percent-encoded — `custos-da-m%C3%A1quina` —
> o que é normal: o navegador decodifica o fragmento antes de comparar com o
> id.)

## Paridade pt-BR / en-US é obrigatória

O app tem exatamente dois idiomas (`pt-BR` e `en-US`), e a Wiki não é opcional
em nenhum deles: **todo `<slug>` existe nas duas pastas, com o mesmo `order`**.
Não existe "artigo só em português" — a queda de locale
(`loadWikiBundle` → `fallbackLocale`) assume que o par existe para que o
conteúdo nunca suma numa troca de idioma.

Isso é **verificado em CI, não por convenção**:
`src/shared/lib/wiki/__tests__/wikiArticles.test.ts` (R6) roda o glob real
(não mockado) e afirma que os slugs e os `order` são idênticos entre os
locales. Um artigo adicionado só em pt-BR falha o gate.

## Fluxo: do `.md` à tela

```
docs/wiki/pt-BR/calculadora.md
        │  (build time — vite/plugins/markdownWikiPlugin.ts)
        ▼
módulo JS: { slug, locale, frontmatter, toc, html }
        │  (import.meta.glob em src/shared/lib/wiki/wikiArticles.ts, lazy)
        ▼
loadWikiBundle(locale) → i18n.addResourceBundle(locale, "wiki", bundle)
        │  (namespace "wiki", uma chunk por locale)
        ▼
WikiPage (lê o bundle via getResourceBundle) → WikiArticle (renderiza o html)
```

1. **`markdownWikiPlugin`** (Vite) intercepta todo `.md` cujo caminho case
   `docs/wiki/<locale>/<slug>.md`, compila com `markdownToHtml()` e emite um
   módulo com `{ slug, locale, frontmatter, toc, html }`. O `slug` e o `locale`
   vêm do **caminho do arquivo**, não do conteúdo — o módulo é a fonte da
   própria identidade. Existe ainda a variante `?wiki-meta`, que exporta só o
   `frontmatter` para um índice eager sem carregar nenhum byte de HTML.
2. **`wikiArticles`** é a única `import.meta.glob` sobre `docs/wiki/`, com
   `eager: false` de propósito: cada locale vira **uma** dynamic import,
   buscada só quando a aba Wiki é aberta pela primeira vez.
3. **`loadWikiBundle`** filtra, ordena por `frontmatter.order` e monta o bundle
   aninhado por slug, escolhendo o locale com fallback quando o pedido não tem
   artigos.
4. **`WikiPage`** monta o namespace via `useWikiNamespace` e renderiza
   `WikiArticle`, que injeta o HTML numa única passada de
   `dangerouslySetInnerHTML`.

## Por que compile-time

A decisão (registrada no council `open3dcalc-wiki-docs`) é: o markdown é
**autorizado** em markdown, mas **nunca parseado em runtime**.

- **Zero parser no client**: a pipeline remark/rehype inteira roda só no plugin.
  O client recebe uma string de HTML e nada mais.
- **Zero dependência nova no bundle**: `unified`, `remark-*` e `rehype-*` são
  **devDependencies** — usadas por este módulo e pelos testes, nunca
  embarcadas.
- **Defesa em profundidade**: o conteúdo é próprio, mas HTML cru é descartado
  pelo `remark-rehype` e o `rehype-sanitize` remove qualquer coisa perigosa, então
  nem `<script>` nem handler de evento chegam ao artigo renderizado.
- **Carregamento lazy validado**: a dynamic import da chunk local foi testada
  sob a CSP `file://` + `script-src 'self'` do Electron (probe de build com a
  CSP de produção ativa); o bundle desktop já depende do mesmo mecanismo para
  outras cinco chunks.

Reverter isso para um parser de runtime exige um novo council — o motivo está
documentado no próprio plugin.

## Adicionando um artigo

1. Crie `docs/wiki/pt-BR/<slug>.md` **e** `docs/wiki/en-US/<slug>.md` (mesmo
   slug, mesmo `order`).
2. Escreva o frontmatter (`title`, `order`, e `tourId` se houver tour).
3. Use só o subset da tabela acima; comece o corpo com um `#`.
4. Rode `npm run test:run` — os gates pegam frontmatter inválido, paridade
   quebrada e markdown fora do subset.

Não há registro manual em lugar nenhum: o glob descobre o arquivo, o plugin o
compila e o i18n o publica. Um arquivo fora de `docs/wiki/<locale>/` (como
`docs/conventions.md`) é ignorado pelo plugin.

## Gates que guardam este contrato

| Teste                                                      | O que pega                                     |
| ---------------------------------------------------------- | ---------------------------------------------- |
| `src/shared/lib/wiki/__tests__/markdownWikiPlugin.test.ts` | Frontmatter inválido, formato do módulo        |
| `src/shared/lib/wiki/__tests__/wikiArticles.test.ts`       | Glob real, paridade de slug/order entre locales |
| `src/shared/lib/wiki/__tests__/loadWikiBundle.test.ts`     | Ordenação, fallback de locale, shape do bundle |
| `src/shared/components/Wiki/__tests__/WikiPage.test.tsx`   | Skeleton → conteúdo, nav, TOC, troca de idioma |
| `src/shared/i18n/__tests__/wikiGuideParity.test.ts`        | Chaves `guide.*` dos cards do drawer de guias  |
