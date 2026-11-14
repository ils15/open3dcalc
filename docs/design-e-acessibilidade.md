# Design, tema e acessibilidade

Invariantes de tema, escala de camadas, primitivas de UI e a cadeia de contraste que os testes medem.

## Invariantes do tema: a classe decide, não o sistema operacional

O tema vive em **uma chave e uma classe**: `localStorage['open3dcalc_theme']` e uma
classe `dark`/`light` no `<html>`, escritas por `src/shared/hooks/useTheme.ts`
(`initTheme()` roda antes do primeiro `render()`). Quatro invariantes
aparentemente óbvias quebram a aplicação silenciosamente se forem movidas —
nenhuma delas falha em build, e todas já custaram um incidente.

**1. `dark:` segue a CLASSE, não `prefers-color-scheme`.** O Tailwind v4 amarra
`dark:` a `@media (prefers-color-scheme: dark)` por padrão, que é um segundo
interruptor independente do que o app usa: quem escolheu **claro** num SO escuro
recebia todas as utilidades `dark:`, e quem escolheu **escuro** num SO claro não
recebia nenhuma. O desvinculo é
`@custom-variant dark (&:where(.dark, .dark *));` em `src/styles/tokens.css`, e
ela fica **imediatamente antes do bloco `@theme inline`** — não no topo do
arquivo. Motivo: os guards de token de `src/shared/__tests__` leem o arquivo com
um scanner chapado de blocos (`/([^{}]*)\{([^{}]*)\}/`), e uma at-rule sem
chaves acima do `:root` é lida como parte do **seletor** dele; a string passa a
começar com `@custom-variant`, não casa nem com `:root` nem com `.dark`, e a
**paleta clara inteira desaparece** da cascata que os testes reconstroem —
transformando toda medição de tema claro em "irresolvível" em vez de falha.

**2. `.light` é âncora na camada de ÁLIAS, não na paleta.** `applyTheme()` adiciona
`.light` no `<html>` a cada render em tema claro, e antes disso **nada** casava
com essa classe. A âncora entra no bloco `:root` de aliases (o que os
componentes consomem via `var(--color-*)`) e **não** no bloco de paleta, pelo
mesmo motivo do scanner: `tokenInBlock(css, ":root", …)` usa `/:root\s*{/`, que
só casa quando `{` vem logo depois de `:root` — escrever `:root, .light` na
paleta faz a regex cair no bloco de alias e medir as declarações erradas.

**3. Utilidade de cor "pelada" só é gerada a partir de `@theme`.** O Tailwind só
sintetiza `bg-accent-fill` a partir de uma entrada em `@theme`, e
`--color-accent-fill` / `--color-accent-fill-fg` existem **apenas** na camada de
álias em tempo de execução — nunca em `@theme inline`. A forma pelada portanto
**não gera CSS nenhum**: o elemento cai no valor herdado. Foi assim que o botão
de saída do Focus Mode perdeu o preenchimento e `selection:text-accent-fill-fg`
deixou o texto selecionado herdar `--color-text-primary` (2,82:1 no tema claro).
Use a forma arbitrária: `bg-[var(--color-accent-fill)]`,
`text-[var(--color-accent-fill-fg)]`. `tailwindUtilitiesResolve.test.ts` exige
que **toda** utilidade de cor usada em `src/` exista em `@theme` ou na paleta
nativa, e falha se alguma não resolver.

**4. A CSP de produção é `script-src 'self'` — o script anti-FOUC é inline e
precisa de hash, e o `<meta>` da CSP precisa ficar ACIMA dele.** O
`index.web.html` e o `index.desktop.html` trazem um `<script>` inline que lê
`localStorage['open3dcalc_theme']` e aplica a classe antes do primeiro paint
(sem ele, `initTheme()` só roda no eval do módulo, depois do CSS). Duas
consequências, ambas verificadas por build:

- a CSP de produção **não** tem `'unsafe-inline'` (só o dev a relaxa, via
  `apply: "serve"` nos configs do Vite), então o script inline precisa de
  `'sha256-…'` em `script-src`, senão ele é descartado em produção enquanto
  continua parecendo correto no código;
- um `<meta http-equiv="Content-Security-Policy">` vale **só para o que é
  parseado depois dele** — ele não é retroativo. Com o script **acima** do meta,
  ele fica isento da política, o `sha256-…` é decorativo, e um hash errado
  continua executando. `studioShellTheme.test.ts` verifica o hash **e** a ordem
  dos dois, porque só o hash não pega isso.

Consequência colateral que vale registrar: `selection:*` usa
`--color-accent-fill`, **não** `--color-accent`. As duas valem `#4f46e5` no tema
claro, mas `--color-accent` vira `#818cf8` no escuro — uma cor de peso de
foreground que só chega a 2,98:1 com tinta branca. O par de seleção mede 6,29:1
nos **dois** temas.
## Primitivas de UI: Select

O componente `Select` (`src/shared/components/ui/Select/Select.tsx`) é o dropdown padrão do app, usado em **15 pontos de uso em 8 arquivos** (CatalogTab, FilamentInventory, InfillCalculator, MaterialSection, PrintSection, SalesSection, FailureSection, HistoryTab). É construído sobre [`@floating-ui/react`](https://floating-ui.com/) (a mesma biblioteca do `Tooltip`) para posicionamento robusto do menu:

| Problema | Solução                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colisão  | `useFloating` + `offset(6)` + `flip()` + `shift({ padding: 8 })` + `autoUpdate` — o menu nunca sai da viewport e abre para cima quando não cabe embaixo                                                                                                                                                                                                                                                                                                                                                         |
| Clipping | O menu é sempre renderizado num `FloatingPortal`, escapando de containers com `overflow` (ex.: o modal `overflow-y-auto` do FilamentInventory)                                                                                                                                                                                                                                                                                                                                                                  |
| Altura   | Middleware `size()` aplica `max-height` dinâmico (cap 420px) e iguala a largura ao trigger                                                                                                                                                                                                                                                                                                                                                                                                                      |
| z-index  | Token `--z-dropdown: 60` da escala única em `src/styles/tokens.css` — acima da bottom nav mobile, abaixo do Tooltip. Ordem da escala: `--z-app-chrome: 20` < `--z-viewer: 30` < `--z-passive: 40` < `--z-shell-chrome: 45` < `z-50` (Tailwind, o **scrim**: um backdrop `fixed inset-0` com fundo escurecido **junto com o painel que ele responde** — ou um diálogo centrado, ou uma bottom sheet de mobile) < `--z-tour: 55` / `--z-tour-card: 56` < `--z-dropdown: 60` < `--z-panel: 70` < `--z-tooltip: 80` |
| Mobile   | Abaixo de 640px o menu vira **bottom sheet**: `position: fixed; bottom: 0`, `max-h-[60dvh]` com scroll interno (hook `useMobileSheet`, reativo a resize/giro)                                                                                                                                                                                                                                                                                                                                                   |

Seletores com imagens (impressoras, marketplaces) agora renderizam **thumbnails**: um `<img loading="lazy" decoding="async">` com _fallback_ automático — se a imagem falha (404/rede), o componente `OptionThumb` exibe um monograma derivado do label, então nenhuma opção fica sem identificação visual. Imagem e monograma são `aria-hidden` (decorativos): o nome acessável da opção continua sendo apenas o label, limpo para leitores de tela. A arte de _fallback_ dos impressores (`fallback-fdm.svg`/`fallback-resin.svg`) e as logos de marketplace são **originais** deste projeto — a atribuição CC-BY-4.0 dos dados técnicos adaptados do _swordlab/open-3d-printer-database_ está em [`docs/CREDITS.md`](CREDITS.md).

> **Nota:** a prop `portal` foi **descontinuada** — o menu agora é sempre portado, então a prop é aceita por compatibilidade da API pública, mas é um _no-op_. Nenhum call site passava `portal`; a API do componente é estável e os 15 pontos de uso acima se beneficiam das correções sem nenhuma mudança de código.

> **Nota (escala de camadas):** a escala está documentada em `src/styles/tokens.css` e se consome como `style={{ zIndex: "var(--z-…)" }}` — o mesmo mecanismo do `Select`, que mantém o valor resolvível (e portanto testável) em vez de inferível de um literal. Ela é ordenada pelo que a superfície **possui**, não pelo tamanho, porque isso é que decide se uma superfície pode cobrir outra. O **invariante** completo, em três regras: **(1)** nada passivo pode ficar acima da saída — uma superfície passiva não tem scrim, não prende foco, não é dona de tecla nenhuma e se descarta sozinha, então é informação e não interrupção, e jamais pode ocultar ou interceptar um controle, muito menos o único controle que encerra o Focus Mode; **(2)** uma superfície **dona** da tela _pode_ ficar acima da saída, e nesse caso ela é dona também do caminho de volta — enquanto ela está aberta a saída cede (via `escapeIsOwnedByOverlay`), e o jeito visível de sair é o **Escape** (ou um clique no scrim), que devolve a saída imediatamente: uma tecla, uma camada; **(3)** uma única superfície **inerte** pode passar de tudo, o tooltip. Pela regra 2 o "sempre" **não** foi estreitado: a saída nunca é destruída nem fica presa, e o pior caso é um Escape de distância, só enquanto uma superfície que ela própria consome com esse Escape estiver aberta (e como entrar no modo força `activeTab: "calculator"`, os modais de outras abas sequer existem nesse estado). Daí a divisão: `--z-passive` (toasts, popovers sem scrim, listboxes limitados, a `PrivacyBanner`) fica **abaixo** de `--z-shell-chrome`; o tier `z-50` passa a significar apenas o scrim — o backdrop `fixed inset-0` com fundo escurecido **junto com o painel que ele responde** (diálogo centrado ou bottom sheet de mobile; o painel divide a banda do próprio backdrop porque precisa ficar acima dele, e os dois são uma camada dona só) — antes ele também admitia os passivos, e era essa sobreposição que enterrava a saída (no `sm+` o toast e a saída compartilham a mesma âncora `sm:top-4 sm:right-4`). Um teste conta **cada ocorrência** de `z-50` na árvore e exige que ela seja um backdrop ou o painel que responde um, com a lista de arquivos derivada em vez de mantida à mão: foi essa contagem que mostrou as duas bottom sheets (`Header.tsx` e `MobileSettingsSheet.tsx`) no tier do scrim, e é ela que impede um `z-50` novo de entrar sem ser contado. A derivação e a classificação foram **extraídas para funções testáveis por fixture** depois que uma mutação provou que, inline, nenhuma das duas estreitezas teria qualquer teste provando que mordem: (a) a busca por arquivo usava `/class(?:Name)?=[^\n]*\bz-50\b/`, que exige `z-50` na **mesma linha** do `className` — um class string quebrado em várias linhas escondia uma camada da auditoria — e agora varre o **texto do arquivo** em busca do token, com **comentários removidos** antes (cinco arquivos deste repositório discutem `z-50` em prosa justamente para explicar por que **não** estão nele, e uma varredura crua os listaria como não auditados). O strip de comentário preserva `https://` via `[^:]`, senão ele truncaria a linha do `href` do `PrivacyPolicy`. (b) O painel de bottom sheet era reconhecido por `rounded-t-2xl`, um proxy **cosmético** que deixava passar qualquer caixa flutuante arredondada em cima e arquivada no tier do scrim; agora o padrão exige `bottom-0`, que é o token que faz o painel ser uma _sheet_ de fato — as duas folhas reais são `fixed bottom-0 left-0 right-0 z-50 … rounded-t-2xl`. E o pareamento passou de "existe um backdrop neste arquivo" (que dois painéis e um scrim satisfazem) para **`panels <= backdrops`**, que é o pareamento que a regra realmente afirma: cada painel responde um backdrop. `--z-viewer` (overlay fullscreen e viewer de toolpath do `StlPreview`, ambos antes em `z-[100]`) fica abaixo do tier passivo para que um aviso nunca se perca atrás de um overlay de tela cheia, e `--z-app-chrome` é a bottom nav das duas plataformas — que tinham drifado para `z-50` e `z-40` do mesmo componente. `--z-dropdown` é onde vivem os menus (`Select`, `MoreMenu`, menu de moeda, `TutorialLauncher`), `--z-panel` o tier de painéis (`GuideDrawer`, `ManageVisibilityButton` — ainda em `z-[70]`/`z-[71]`), e `--z-tour`/`--z-tour-card` o scrim e o card do tour guiado (ex-`z-[55]`/56): o tutorial tem scrim, clique para dispensar e consome o Escape (`finishTutorial`), então é uma superfície dona pela regra 2 e **tem** lugar acima da saída — é por isso que a regra 2 existe, e o teste dirige o tutorial real para provar que ele termina com o mesmo Escape. Única exceção inerte: `--z-tooltip` fica no topo porque um anotador precisa passar por cima de qualquer camada onde o seu trigger possa estar — **e isso é uma regra do primitivo, não um fato sobre os call sites atuais**: o `InputGroup` só renderiza o tooltip quando recebe a prop `tooltip`, e hoje nenhum `tooltip=` está dentro de um modal, painel ou menu, então essa faixa é headroom, fixada por teste e não por um uso existente. E para ficar registrado: um toast aberto enquanto há um modal com scrim agora é desenhado **atrás** dele (consequência da regra 1) — os pixels se perdem, o anúncio não, porque o container do toast é `aria-live="polite"` e nenhum modal da árvore aplica `inert`/`aria-hidden` nos irmãos.
## Cadeia de contraste: tokens de preenchimento e o Toast

O app mede contraste com a matemática WCAG 2.1 em `src/shared/__tests__/helpers/contrast.ts`, usada pelos testes: `tokens.test.ts` (nível de token), `accentBackgroundContrast.test.ts` (call sites, que varre as class strings do `Toast.tsx`) e `Toast.test.tsx` (que **renderiza** o componente real e mede as classes resultantes do DOM). O `Toast` em si não importa esse helper — é o que os testes medem, não o componente. A regra que organiza a família toda:

> **Um token de fundo e a tinta que fica sobre ele são escolhidos como um par, e nenhum dos dois muda com o tema.**

### O defeito

O `Toast` pintava `bg-[var(--color-danger)]/90`, `bg-[var(--color-success)]/90` e `bg-[var(--color-accent)]/90` com `text-[var(--color-text-primary)]`. Isso é a **mesma falha estrutural** que `--danger-fill` / `--warning-fill` já existiam para remover: um token de **primeira plana** (foreground) usado como **fundo**, emparelhado com uma tinta que **vira near-white no `.dark`**. O par que funciona num tema quebra no outro, e nenhuma tinta única corrige os dois.

| variante  | light (antes) | dark (antes) | light (depois) | dark (depois) |
| --------- | ------------- | ------------ | -------------- | ------------- |
| `error`   | 3.10:1        | **2.07:1**   | 4.77:1         | 4.77:1        |
| `success` | 3.84:1        | **2.10:1**   | 5.36:1         | 5.36:1        |
| `info`    | 3.38:1        | 3.18:1       | 6.29:1         | 6.29:1        |

Os seis pares reprovavam WCAG 1.4.3. Em dark, o toast de erro era um pílula rosa-claro com texto quase branco — não um contraste insuficiente, era um toast ilegível.

### A decisão: tinta pareada + preenchimento sólido

Três opções foram avaliadas:

| opção                            | veredito          | por quê                                                                                                                                                                                                                                                            |
| -------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baixar o alpha (`/90` → `/60`)   | **rejeitada**     | o alpha **não é a causa**, é o amplificador. Diminuí-lo move a cor efetiva _mais_ para perto do que está atrás — e o toast é `fixed` sobre conteúdo arbitrário, então o par deixa de ser decidível a partir da class string. Não há como provar que ficou correto. |
| Tinta pareada sobre fundo sólido | **escolhida**     | o fundo sólido dispensa totalmente a hipótese de backdrop, e cada variante leva a sua tinta que não vira — exatamente como `--accent-fill-fg` e `--danger-fill-fg`.                                                                                                |
| Fundo semântico novo             | **desnecessária** | `--accent-fill` e `--danger-fill` já eram o padrão certo; faltava o terceiro membro da família.                                                                                                                                                                    |

O **sólido** também importa mecanicamente: `isSolidBg` mede apenas fundos sólidos, então um `/90` deixaria o toast no ponto cego documentado do guard. Tokenizar levou o toast para dentro do alcance da guarda principal.

### Tokens

`--positive-fill: #007a55` e `--positive-fill-fg: #ffffff` (Tailwind v4 `emerald-700`), declarados **em `:root` e em `.dark` com valores idênticos** — é a redundância proposital que faz uma edição de um tema só virar falha de teste. `white` sobre `#007a55` dá 5.36:1, e o preenchimento segura 5.01:1 contra o canvas claro e 3.66:1 contra o escuro, então o corpo do toast continua visível como contorno (WCAG 1.4.11).

Sem `-hover` de propósito, ao contrário dos outros dois: aqueles respondem a um **botão**. Um toast é `role="region"`, não tem interação de ponteiro e se descarta sozinho — um token de hover ficaria sem consumidor, que foi exatamente como `--accent-fill` foi declarado e não usado.

O `accentBackgroundContrast.test.ts` lê as class strings reais do `Toast.tsx` em vez de repetir numa tabela, mede cada variante sobre as 5 superfícies em ambos os temas, e exige que a tinta **não vire** entre eles — a asserção que sobrevive a uma refatoração que mude as cores.

### O botão de fechar e o indicador de foco

A correção do texto deixou duas coisas sem medir, e as duas reprovavam. Um botão de fechar é um **controle**, e o indicador visual de um controle é um caso de **contraste não textual** — WCAG 1.4.11 pede 3:1, não os 4,5:1 do texto. O texto da mensagem passar em 1.4.3 não dizia nada sobre o botão.

| o que estava                                          | medido                                | agora                                    | barra (1.4.11) |
| ----------------------------------------------------- | ------------------------------------- | ---------------------------------------- | -------------- |
| glifo do fechar a `opacity-70` sobre o fill de danger | **2,75:1**                            | `opacity-90` → **4,01:1** (hover 4,77:1) | 3:1            |
| anel de foco `ring-[var(--color-accent)]/50`          | **1,00:1** no fill de info (light)    | anel opaco de duas tonalidades           | 3:1            |
| o mesmo anel com `opacity-90` no **botão**            | **4,01:1** em vez de 4,77:1 no danger | opacidade movida para o **glifo**        | 3:1            |

O anel antigo media **1,00:1** porque em light `--color-accent` e `--color-accent-fill` são o mesmo valor (`#4f46e5`): o anel a 50% compunha exatamente o próprio fill._some e `focus-visible:outline-none` desligava o contorno do navegador que teria servido de reserva — foco chegava e nada era desenhado.

A opacidade fica **só no glifo** (`<X>`), nunca no botão: `opacity` no elemento compõe junto o `box-shadow` do anel, que é como o anel é pintado, e o indicador saía 4,01:1 em vez dos 4,77:1 que o token entrega. O glifo mantém os seus 4,01:1 em descanso e 4,77:1 no hover, e a hierarquia dele contra a mensagem não muda. Duas regressões garantem que isso não decai: uma falha se qualquer `opacity` voltar ao botão ou a até quatro ancestrais, outra falha se o glifo parar de estar desênfatizado — assim "mover" não vira "apagar".

A troca é por **duas tonalidades**, porque uma cor não dá conta disso: o anel claro senta no fill saturado e passa de 4,77:1 a 6,29:1 em todas as variantes, e o offset escuro é a única parte que encontra uma superfície de página, passando de 17:1 a 20:1 contra as claras. Os tokens são `--focus-ring-light` e `--focus-ring-dark`, declarados em `:root` e em `.dark` com valores idênticos — um anel de foco que troca de tema é um anel que some em um deles. Nenhum dos dois é uma cor de foco geral: o claro é 1,00:1 sobre `--surface-raised` e o escuro é 1,00:1 sobre o canvas escuro, e é por isso que o componente escolhe o par pelo próprio fundo.

`Toast.test.tsx` **renderiza** o componente e mede as classes que o DOM realmente tem. Isso importa: `expect(button.className).toContain("ring-white")` passaria para uma classe que nunca renderiza, num tamanho que não desenha nada, ou com um alpha que cancela o fill. O teste afirma as razões reais.

### O hover dos 30 controles do Studio: fill → anel

A segunda metade da cadeia é a **identidade visual** dos botões do Studio, e ela mudou de forma em 30 componentes. O commit `db81b99` subiu 36 pares de acento a AA de texto (1.4.3) e, fazendo isso, **inverteu a direção do hover**: ele clareava (`-500`) e passou a escurecer (`-700`/`-800`). Texto melhorou; a fronteira do controle piorou, e nada media isso.

O fundo do Studio é `#080c14` (`StudioLayout.tsx:124`) e 1.4.11 pede 3:1 na fronteira. Medido com a aritmética do próprio repositório, o hover invertido dava **2,47 a 2,86:1** — abaixo da barra nas cinco famílias, caindo exatamente no momento da interação.

**Não dava para simplesmente voltar.** O hover pré-`db81b99` (`-500`) devolvia a fronteira, mas reprovava 1.4.3 nas cinco (2,13 a 4,12): aquele hover **já era** um defeito, e `db81b99` corrigiu um defeito real — só a direção da correção estava errada. Pior, e é o que trava o desenho: **não existe passo destas cinco famílias que satisfaça texto ≥4,5 E fronteira ≥3 ao mesmo tempo**. A tinta branca exige o fill escuro, a fronteira exige o fill claro, e a interseção é um único passo por família — o próprio de repouso. Logo o **fill do hover não pode se mexer**, e `hover:bg-<fam>-<reposo>` seria uma classe no-op.

O affordance foi para um **anel**, pintado fora do fill (`hover:ring-2 hover:ring-<fam>-500/40`), reusing o idioma de anel que já existia na árvore. O que ele faz, medido — e o que ele **não** faz:

| família | fronteira/hover antes (fill) | affordance antes → agora | anel vs fundo |
| ------- | ---------------------------- | ------------------------ | ------------- |
| blue    | 2,86                         | 1,30 → 1,75              | 1,75:1        |
| purple  | 2,77                         | 1,28 → 1,65              | 1,65:1        |
| rose    | 2,47                         | 1,31 → 1,64              | 1,64:1        |
| emerald | 2,57                         | 1,42 → 2,13              | 2,13:1        |
| amber   | 2,76                         | 1,41 → 2,30              | 2,30:1        |

**O anel não cumpre 1.4.11 no hover, e vale ser explícito sobre isso.** A 40% de opacidade sobre `#080c14` ele dá **1,64 a 2,30:1** — abaixo de 3:1; para limpar a barra seria preciso alfa entre 0,51 e 0,74. O que ele faz é devolver ao repouso a fronteira que o hover tinha tirado (o fill não muda mais, então a fronteira que identifica o controle se mantém em 3,24 a 3,89 durante toda a interação) **e** aumentar o affordance: o delta entre repouso e hover passa de 1,28–1,42:1 para 1,64–2,30:1 contra o fundo, de 1,25× a 1,63× mais sinal.

Isso está alinhado à leitura que o repositório já adota: `tokens.test.ts` declara no comentário que o hover **não** é asseverado porque _"1.4.11 governs the resting state that identifies the control, and a transient hover is not required to re-establish it"_. Nenhuma das duas metades era "reforçar 1.4.11 no hover" — é a fronteira de repouso que o critério rege, e a melhoria real é de affordance e de estabilidade.

O anel não adiciona `filter`, então também não cria stacking context novo — o que importa numa branch que acabou de corrigir os tiers de z-index. E o escopo da troca é derivado do **diff do próprio `db81b99`**, não de uma lista escrita à mão, então um sítio que aquele commit não tocou não pode ser capturado por ela: foi isso que deixou de fora `CatalogTab.tsx:560` (fill de token com hover de paleta crua) e `StudioSubHeader.tsx:195` (hover translúcido pré-existente).

### O piso da população adiada, medido em _sites_

O guard conta uma população que ele **mede mas não fiscaliza**: as washes translúcidas e os fundos de paleta do Tailwind. Essa população é pinada como piso de regressão — e o piso é expresso em **sites**, nunca em arquivos.

A contagem por **arquivo** é a unidade errada porque **não enxerga um site mudando de forma**: migrar `bg-[var(--color-accent)]/20 text-[var(--color-accent)]` para um pareamento quebrado _diferente_ deixa a contagem de arquivos intacta, e o piso reporta verde sobre uma população tão quebrada quanto antes.

Quatro chaves já foram tentadas e três foram reprovadas, com razão — e são elas que explicam por que um **site** hoje é o elemento:

| chave                         | o que não enxerga                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| contagem de arquivos          | um site corrigido e um site que mudou de forma dão o mesmo número                                                    |
| conjunto **global** de formas | um site que migra de uma forma já permitida para **outra** forma já permitida: contagem igual, conjunto igual, verde |
| `arquivo#declaração#ordinal`  | a **substituição na mesma declaração**: dois elementos trocam de pareamento e todo ordinal continua no lugar         |
| forma (ou hash da forma)      | dois sites da mesma forma são indiscerníveis — a mesma falha com passos a mais                                       |

**A identidade de um site é o elemento JSX que o possui**, resolvida por um esquema híbrido:

1. **Um atributo estático que o elemento já tem** — `SpoolThumb` já carrega `data-testid="spool-thumb"`, e ele é reutilizado. Não acrescentar nada é melhor do que acrescentar algo, e um `data-testid` existente já promete que o elemento é endereçável isoladamente.
2. **Um comentário source-only ao lado do elemento** — `{/* contrast-site: <id> */}` quando o elemento está entre irmãos, e `/* contrast-site: <id> */` quando ele é a primeira coisa dentro de uma expressão parenthesada (`return (`, `{x ? (`, `{x && (`). Lá as chaves seriam um **literal de objeto** numa expressão, não um comentário, e o arquivo não compilaria. A forma é **derivada** da linha acima do elemento, e não assumida — foi essa derivação que pegou três sites que a lista manual dava como forma JSX.

O `data-testid` dinâmico do `ChangelogPage` (``data-testid={`latest-badge-${entry.version}`}``) **não** é identidade: um valor por render nomeia um source site só quando acerta. E `aria-label` nunca é consultado — em 20 destes sites ele é localizado, o que tornaria a chave uma string de tradução.

**Nenhum atributo de runtime é adicionado.** Os dois formatos de comentário são source-only: o formato JSX não renderiza nó nenhum, e o formato simples nem sequer é uma expressão JSX.

O censo reporta, por site, a **identidade do elemento** e as **formas** que ele tem hoje, e o pin é `identidade -> formas[]`. São **duas** formas por site em quatro elementos, que emparelham `bg-emerald-600` e o seu `hover:bg-emerald-500` com a mesma tinta. Identidade e forma são separadas de propósito: a identidade sobrevive a reformatação, deslocamento de linha e reordenação, porque nada disso move um comentário preso ao seu elemento; a forma é justamente o que o pin guarda como **valor** e o que pode mudar.

**A posse de uma identidade é exclusiva, e é posicional.** Um marcador — ou um `data-testid` estático — nomeia **exatamente um** elemento, e um marcador nomeia **apenas o próximo elemento JSX real**, sendo consumido uma única vez. Se esse elemento não tiver pareamento adiado, o marcador **não** é órfão — é o que um sítio corrigido parece — e um elemento posterior **não** pode herdá-lo. **Órfão** significa um marcador que não nomeia **nenhum** elemento JSX real.

Isso fecha um vazamento real. A versão anterior escolhia o marcador mais próximo _antes_ de um literal de classe, o que não é a mesma coisa: um marcador cujo elemento não tinha pareamento adiado entregava sua identidade ao elemento seguinte, de modo que um sítio podia acabar nomeado por um comentário que estava acima de um irmão. O vínculo agora é calculado adiante e não é herdável.

Três condições reprovam, e **nenhuma delas é visível comparando totais** — com dois elementos de mesma forma, contagens e multiconjuntos são idênticos ao caso saudável, o que é exatamente por que a verificação é sobre posse e não sobre somas:

| condição             | o que significa                                                                                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| órfão                | o marcador não nomeia **nenhum** elemento JSX **real** — sobrou de um elemento apagado, ou nada segue ao comentário. Um elemento que existe mas **não tem** pareamento adiado **não** é órfão: é o que um sítio corrigido parece |
| identidade duplicada | uma identidade alcançada por dois elementos, por marcador ou por atributo                                                                                                                                                        |
| marcador ambíguo     | dois marcadores reivindicando o mesmo elemento, que então não tem nome inequívoco                                                                                                                                                |

**Nenhuma contagem é asserida, e isso é deliberado.** Nenhuma asserção deste ficheiro conta a população de sítios. Saíram as contagens **exatas** (22 elementos proprietários, 26 pareamentos, 21 marcadores) e saíram também os **pisos** que as versionais anteriores usavam como garantia de que a varredura não ficou em silêncio: `pairings.length > 20`, `shapes.size > 10`, `census.failing.length <= 15`, `palette.failing.length <= 11` e `census.failing.length > 0`. Todos eles punem o trabalho que a guarda existe para fiscalizar — `failing > 0` reprovaria no dia em que o último sítio fosse corrigido, e `pairings.length > 20` reprovaria quando a população passasse de 21. O inventário medido em `1b84671` — 22 elementos proprietários, 26 pareamentos de forma, 21 comentários de fonte em 14 arquivos de produto, 0 sem identidade, 0 falha de posse, 4 elementos com duas formas, 1 elemento resolvido pelo `data-testid` reutilizado — fica como **retrato datado**: não é limiar, não é gate, e nenhum teste o compara. São os mesmos números desde `26cc674`, que não tocou fonte de produto; foram re-derivados em `1b84671` em vez de transportados.

**Evidência dos seis gates.** Árvore exata cujos seis gates valem: `1b846719e62a5c49e15e574b25055a1a00abe6e3` — rodados nela, com saída 0 nos seis: `test:run` (**236 arquivos / 3294 testes**), `test:run -- --coverage` (os mesmos 236 arquivos / 3294 testes, **82,97% statements, 77,01% branches, 78,58% functions, 84,04% lines**, sem timeout), `typecheck`, `typecheck:electron`, `lint` e `build:all`. O commit de documentação que traz estas figuras **segue** `1b84671` e **não** foi ele próprio uma execução dos seis gates.

**Cobertura: o agregado passa, o detalhe é divulgação.** Os quatro agregados estão acima do **mínimo de 60% que o utilizador aprovou para a Beta 5**, e esse 60% é um **critério de aceitação da release, não um threshold que o CI imponha**: o Vitest tem thresholds **globais** `(statements 30, branches 26, functions 28, lines 33)` e **não** tem thresholds por ficheiro. A conferência dos quatro agregados é feita manualmente, no **gate final da Themis**. A tabela de cobertura tem 262 ficheiros, dos quais **38 abaixo de 60% de linhas**, **70 abaixo de 80%** e **12 a 0%** — `db-bridge.ts`, `storageAdapter.ts`, `RechartsLazy.tsx`, `useCurrency.ts`, `csvExport.ts`, `quoteApi.ts` entre outros. Esses números são **divulgação, não um gate por ficheiro**. Uma afirmação anterior de que nenhum ficheiro estava abaixo de 80% **estava errada** e foi removida. **Implementação e gates completos; revisão e merge da Themis pendentes. Nada liberado.** Este trabalho é só o stage do Toast/guard: o **#221 continua aberto, fora deste stage**, e fica enfileirado a seguir, na ordem de um PR por vez.

**O que substitui a contagem, e o que fica comoaranteia.** A direção vem do **pin por sítio**: identidade -> formas, validado só sobre o fonte atual. E a garantia de que a varredura não está muda passou de um número para **fixtures dirigidas pelo scanner de produção** — fonte que o teste possui, passada por `scanWashesInSource` e `scanPaletteInSource`, exigindo que encontre os pareamentos que foi escrito para achar e que reporte zero numa fonte sem nenhum. Resta **uma** medição real, a única que não pune uma correção: `unresolved` tem de ser **0** em ambas as famílias, porque o censo falha fechado e um par indecifrável tem de aparecer em vez de passar por limpo. A exigência de que a metade **passing** fosse não vazia **também era um piso** — mesmo que só apontasse no sentido seguro, continuava a ser um número sobre a população real, e por isso saiu com os outros. A asserção sobre a árvore real é de integridade e passa hoje: a varredura resolve, todo sítio atual bate com o seu pino, e não há identidade ambígua, órfã, duplicada nem reaproveitada.

**O parser é memoizado pelo texto exato do ficheiro.** A posse é resolvida pela AST do TypeScript, e a AST é cacheada por **texto exato**, não por caminho — deliberadamente, porque os testes integrados trocam o fonte de **um** ficheiro entre passagens para simular uma correção. Uma chave por caminho devolveria a AST da passagem anterior para o ficheiro sobrescrito, e a guarda validaria uma árvore obsoleta. Com o texto como chave, uma sobrescrita é outra chave e é reanalisada a sério, enquanto os outros ficheiros vêm da cache. É por isso que os dois testes integrais que percorrem a árvore não rebentam o timeout: o custo deixou de ser multiplicado pelo número de passagens.

**O pin é de uma direção só.** Um sítio corrigido deixa entrada obsoleta e **não** gera falha, porque corrigir um sítio nunca pode reprovar a suíte — só baixar a contagem. A asserção que exige o contrário, que toda forma pinada ainda apareça em algum lugar da árvore, é removida de propósito: ela falharia exatamente quando a política estaria funcionando, porque resolver o último dono de uma forma tira a forma da população, e isso é progresso. O que é verificado é a direção oposta — todo sítio **atual** existe, tem exatamente uma identidade e casa com o **seu próprio** valor pinado; identidade nova ou forma alterada reprova. A validação é de **uma direção só, sobre o fonte atual**: todo sítio que está a falhar tem identidade pinada única e a sua própria forma; identidade nova, forma alterada, ambiguidade, identidade em falta e par não resolvido reprovam. Um sítio resolvido deixa entrada obsoleta e não gera falha. É o **pin por sítio** que substitui a contagem, e é mais forte: ele nomeia o sítio, enquanto um total apenas notaria que alguma coisa mudou sem dizer o quê.

A regressão do sítio resolvido corre pelo **caminho integrado de produção**, `validateRealTree`, que varre todos os componentes, resolve a identidade de cada pareamento, recolhe as falhas de posse e compara cada sítio atual com o seu pino. A versão anterior filtrava a resposta do censo e chamava `siteFaults` — o que, por construção, não vê uma falha de identidade, e portanto não falharia quando um sítio corrigido fosse acusado de órfão. Três testes o dirigem, substituindo o fonte de um ficheiro e deixando o resto da árvore real: um sítio corrigido de facto passa com a entrada obsoleta intacta; um sítio novo com identidade inédita reprova por `unpinned`; uma forma que mudou no sítio real reprova por `changedForm`. O sítio escolhido é `price-hero-margin-label`, wash cujo dono único é ele próprio — a wash de acento tem cinco donos e passaria pelo motivo errado.

**A identidade é estável, e o custo é real.** Sobrevive a deslocamento de linha, edições acima do site, reformatação, reordenação e mudança de forma. O custo assumido é de **volume**: 21 comentários source-only em 14 arquivos de produto, em arquivos que não têm relação com acessibilidade. A alternativa era uma anotação estável dentro do fonte, que seria mais forte e exigiria ainda mais churn; e ancorar em linha, ordinal ou forma foi reprovado porque não vê a substituição. O outro custo é o de manutenção: um site corrigido deixa entrada obsoleta no pin, porque a política é deliberadamente **de uma direção só** — corrigir um site nunca pode reprovar a suíte.

**O censo falha fechado.** Um pareamento que ele não consegue decidir — um passo de paleta fora do mapa do Tailwind, uma tinta com token não declarado — vai para `unresolved` e **não** conta como site em nenhuma direção. A alternativa é o defeito corrigido aqui: um site descartado é invisível para **qualquer** verificação que conte sítios, e `worst` deixado em `Infinity` classificava um pareamento não medido como **aprovado** — uma medição ilegível registrada como limpa, e a ausência dela lida como progresso.

**A regressão passa pelo scanner de produção, e está commitada.** As provas anteriores passavam identificadores fabricados direto para a comparação, e nunca exercitavam o parsing; uma delas chegou a afirmar prova por mutação sem que os testes correspondentes tivessem entrado no commit. As de agora dirigem `scanWashesInSource` e as funções reais de identidade sobre fonte malformada, e afirmam sobre as falhas que o código produziu:

- um marcador antes de um elemento pareado e depois um **segundo** elemento pareado: o primeiro consome o marcador e o segundo é reprovado como **sem identidade** — sem herança;
- marcador antes de um elemento que **já não tem** pareamento adiado, seguido de um elemento pareado: **não** é órfão, e o par posterior continua sem identidade, de modo que o pino o acusa como sítio novo e não pinado — faulta correta para um sítio corrigido;
- dois marcadores num elemento só: **marcador ambíguo**;
- id de marcador duplicado em dois elementos, e `data-testid` estático duplicado: **identidade duplicada**;
- marcador sem nenhum elemento depois: **órfão**;
- a troca A/B na mesma declaração, com multiconjunto e contagem do arquivo idênticos e os dois sítios nomeados. Anteriormente isso reprovava por uma contagem de formas por família; já não há contagem nenhuma, e ele reprova pelo pin, nomeando os dois sítios.

Não há teste de mutação commitado neste repositório, e nenhuma das afirmações acima é um teste de mutação. O que existe são **regressões de comportamento** que passam pelo scanner de produção e afirmam sobre as falhas que o código de produção produziu, mais **duas mutações manuais feitas durante este trabalho** e revertidas em seguida: (1) **repor a regra de órfão antiga**, a que marca como órfão um elemento que existe mas já não tem pareamento adiado — o teste do sítio corrigido passou a reprovar, nomeando `price-hero-margin-label [orphanMarker]`, que é exatamente o defeito, e o teste antigo basado em `siteFaults` sobre linhas filtradas à mão **não** reprovou, como se previa; (2) **neutralizar `siteFaults`** — dez testes reprovaram, incluindo os três integrados. Ambas são reconferíveis reaplicando a alteração; a garantia de que os restantes casos reprovam sob as respetivas mutações vem de os testes afirmarem sobre a falha produced, não sobre um número.

Duas correções de parsing vieram junto: o `stripComments` passou a preservar **tamanho**, não só quebras de linha — o branch de `//` apagava texto, então um offset no fonte removido não era um offset no original, e a resolução de identidade encontrava elementos centenas de linhas longe; e a tag proprietária é lida até o `>` correspondente, com-awareness de string e de chave, para que `onClick={() => …}` não trunque a varredura.

Os números citados antes no cabeçalho do arquivo estavam **errados por ~2,5x**, e errados na direção que faz um piso parecer _menos_ trabalho do que existe:

| família         | citado (antigo)  | real (commit base)                 | medido em `1b84671`                   |
| --------------- | ---------------- | ---------------------------------- | ------------------------------------- |
| washes          | 48 / 13 arquivos | 18 sites / 10 formas / 11 arquivos | **15 sites / 8 formas / 10 arquivos** |
| paleta Tailwind | 27 / 8 arquivos  | 11 sites / 4 formas / 7 arquivos   | **11 sites / 4 formas / 7 arquivos**  |

A coluna da direita deixou de ser um alvo de teste. As contagens de sítios e de formas foram **retiradas** — eram pisos, e um piso reprova o progresso — e o que substitui cada uma é o **pin por sítio** descrito acima. A tabela fica como registo do que foi medido e quando; nenhum teste compara estes números.

A queda de 18 para 15 é o toast: as três variantes `/90` saíram da população ao virarem preenchimentos sólidos. Além disso, o regex antigo casava **só o token accent**, então nunca contou as washes de status — `--color-danger/90` e `--color-success/90` eram invisíveis para ele, e eram os **dois piores pares do app**. Um piso que não cobre a população da qual é piso é decoração.

A lista de formas é uma **allowlist de uma direção só**: uma forma nova, não listada, reprova; uma forma listada que deixou de ocorrer **não** reprova, porque a regra deste arquivo é que corrigir um site nunca pode reprovar a suíte. **O custo disso é real e vale nomear: um site migrado deixa uma linha obsoleta aqui.** Foi aceito em vez de resolvido com uma asserção bidirecional porque a alternativa pune exatamente o comportamento que a guarda existe para encourenciar — e uma guarda que grita lobo acaba desativada. A contagem de sites **não** está pinada ao lado da lista, e é essa a forma final do compromisso: o pin por sítio dá a direção sem dar o número.
