# Changelog

## [1.3.0] — 2026-05-25

### ✨ Novo

- **Sistema Multi-Moeda** — suporte a BRL/USD/EUR/GBP com auto-detecção baseada no locale do navegador. Nova lib `src/lib/currency.ts` e hook `src/hooks/useCurrency.ts`.
- **Seletor de Moeda no Header** — dropdown no header com opções Automático, BRL, USD, EUR, GBP.
- **Inventário Reformulado** — reformulação completa do `FilamentInventory.tsx` com SVG spool icons, busca textual, filtros por material/status, edição de rolos, paleta de cores e badges de status.
- **Status de Carretéis** — novo campo `status` (Em estoque / A caminho / Vazio) e `purchaseStore` por rolo, com migração automática de dados legados.
- **Custos Fixos na Navegação** — seção "Custos Fixos" adicionada à navegação lateral da calculadora.

### 🎨 UX

- Seletor de moeda com fallback automático (pt-BR → BRL, demais → USD).
- Loader "Carregando..." quando resultados da calculadora estão nulos.
- Labels de navegação lateral e descrições de seção agora internacionalizadas via i18n.
- Labels do gráfico de pizza no ResultsPanel agora usam chaves i18n.

### 🔧 Técnico

- `lib/currency.ts` — sistema de moedas com formatação locale-aware via `toLocaleString`.
- `hooks/useCurrency.ts` — hook unificado consumindo `calculatorStore.currency` + i18n language.
- `stores/calculatorStore.ts` — novo campo `currency: CurrencySetting` com persistência em localStorage via auto-save.
- `stores/filamentInventory.ts` — novos campos `colorHex`, `status`, `purchaseStore`; novo método `updateSpool()`; função `migrateSpool()` para dados legados.
- `vite.config.ts` — exclude `three`, `@react-three/fiber`, `@react-three/drei` do `optimizeDeps` para evitar erros de build.
- Todas as ocorrências de `R$` hardcoded substituídas pelo `useCurrency` hook em 7 componentes.

## [1.2.0] — 2026-05-25

### ✨ Novo

- **Estrutura de Colaboração** — documentação completa de contribuição, templates de PR e issues, políticas de branch.
- **CONTRIBUTING.md** — guia completo com fluxo fork → branch → commit → PR → review → merge.
- **PULL_REQUEST_TEMPLATE.md** — template com checklist de qualidade para todos os PRs.
- **Issue Templates** — formulários estruturados para bug report e feature request.
- **SECURITY.md** — política de segurança e processo de report de vulnerabilidades.
- **CODEOWNERS** — revisão automática do mantenedor para todo o código.
- **MAINTAINERS.md** — documentação de papéis e responsabilidades.
- **README.md** — seção "Contribuindo" revisada com tabela de políticas.

### 🔧 Técnico

- CI/CD aprimorado com jobs paralelos (lint, typecheck, test, build) e relatório de coverage.
- Husky + commitlint + lint-staged para validação automática de commits.

### 📚 Qualidade

- Política de branches e proteção de main documentada.
- Regras claras de code review e merge.
- Conventional Commits padronizados e validados.

## [1.1.0] — 2026-05-20

### ✨ Novo

- **AMS Multi-material** — suporte a impressoras multifilamento (Bambu Lab AMS, Prusa XL). Até 4 slots com material, cor, peso, purga e densidade individuais. Cálculo automático de custo total incluindo purga por transição entre materiais.
- **Inventário → Calculadora** — selecione carretéis do inventário para preencher automaticamente tipo e custo/kg na calculadora.
- **Catálogo → Calculadora** — impressoras, materiais e marketplaces customizados no Catálogo aparecem nos selects da calculadora.
- **Carregar do Histórico** — cada item salvo no histórico pode ser restaurado completamente na calculadora (snapshot completo do estado).
- **Auto-save** — formulário salvo automaticamente a cada 800ms + salvamento síncrono no `beforeunload`.
- **ConfirmDialog** — componente modal estilizado substituindo `confirm()` nativo em todas as ações destrutivas.
- **StoreBridge** — camada de orquestração entre stores (catálogo, inventário, calculadora, histórico).

### 🎨 UX

- Unidades (g, %, R$/kg, etc.) movidas para fora das caixas de input — visual mais limpo.
- Headers de seção simplificados — remoção dos toggles "setinha" que ocupavam espaço.
- Grids responsivos — no máximo 2 itens por linha em todos os formulários.
- Padding reduzido em cards, grids e headers — mais conteúdo visível sem scroll.
- Modo rápido movido para linha própria abaixo dos abas FDM/Resina.

### 🔧 Técnico

- `types/index.ts`: novo tipo `AMSSlot`, `PrinterProfile.maxFilaments`, `CalculationSnapshot` com suporte a AMS.
- `stores/calculatorStore.ts`: auto-save com debounce, `loadHistoryItem()`, `fdmAmsEnabled`/`fdmAmsSlots` + setters.
- `stores/storeBridge.ts`: `selectSpool()`, `restoreAutoSnapshot()`.
- `stores/productStore.ts`: `save()` aceita `snapshot` opcional.
- `components/ui/ConfirmDialog.tsx`: componente reutilizável com focus trap, ESC close, 3 variantes.
- Cálculo AMS integrado ao `computeStoreResults()` — soma custo de slots ativos + purga por transição.
- Upload STL/G-code integrado com AMS — popula primeiro slot ativo.
