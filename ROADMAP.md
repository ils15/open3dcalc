# 🗺️ Roadmap — Open3DCalc

> Planejamento de melhorias baseado na análise do estado atual do produto.

---

## 🔍 Diagnóstico atual

### ✅ O que funciona bem

- Cálculo FDM e Resina completamente funcional com 12+ seções
- Resultados em tempo real via Zustand com `computeStoreResults`
- Toggle por seção (habilitar/desabilitar custos individualmente)
- Export PDF / CSV / JSON
- Inventário de Filamentos com rastreio de peso e alertas de estoque
- Catálogo de impressoras, materiais e marketplaces editável
- Dashboard com KPIs, gráfico de pizza, projeção mensal e Print vs Buy
- Histórico com modal de detalhes e busca

---

### ⚠️ Problemas identificados

| Área             | Problema                                                                   | Impacto |
| ---------------- | -------------------------------------------------------------------------- | ------- |
| **Histórico**    | Não é possível carregar um item do histórico de volta na calculadora       | Alto    |
| **Histórico**    | Sem ordenação (por data, preço, nome)                                      | Médio   |
| **Histórico**    | Sem comparativo lado a lado entre dois registros                           | Médio   |
| **Histórico**    | Sem importação de JSON (só exporta)                                        | Baixo   |
| **Dashboard**    | `printsPerMonth`, `buyPrice`, `targetSellPrice` resetam ao fechar          | Médio   |
| **Dashboard**    | Sem gráfico de tendência de lucro ao longo dos cálculos salvos             | Médio   |
| **Dashboard**    | Sem análise de break-even (quantidade mínima para cobrir custo fixo)       | Médio   |
| **Catálogo**     | Impressoras e materiais customizados não aparecem no select da calculadora | Alto    |
| **Catálogo**     | Sem edição inline de itens existentes (só adicionar/remover)               | Médio   |
| **Inventário**   | Nenhuma integração com a calculadora (carretel não preenche custo/kg)      | Alto    |
| **Inventário**   | Dedução de peso só tem botões fixos (-10g/-50g/-100g), sem campo livre     | Baixo   |
| **Inventário**   | Sem filtro por material ou marca                                           | Baixo   |
| **Inventário**   | Sem edição de um carretel existente                                        | Médio   |
| **UX Geral**     | Auto-save inexistente — usuário precisa clicar "Salvar Configurações"      | Alto    |
| **UX Geral**     | `confirm()` nativo para deletar/limpar (feio, sem acessibilidade)          | Médio   |
| **UX Geral**     | Quick Mode ativo, mas sem tooltip ou explicação do que muda                | Baixo   |
| **UX Geral**     | Sem estado de onboarding para novos usuários (tela em branco sem context)  | Médio   |
| **ResultsPanel** | Dois sistemas de histórico separados (sidebar vs HistoryTab) — duplicação  | Alto    |
| **Mobile**       | Navegação inferior funcional, mas sem acesso rápido a PDF/CSV no mobile    | Baixo   |

---

## 🚀 Fases de Implementação

---

### Fase 1 — Fundação & Quick Wins

> **Meta:** Corrigir os problemas de maior impacto e integrar as partes soltas.

#### 1.1 Auto-save de configurações

- Salvar automaticamente no `localStorage` a cada alteração (com debounce de 800ms)
- Remover o botão "Salvar Configurações" ou transformá-lo em feedback visual passivo
- Adicionar indicador de "Salvo automaticamente" no canto do painel de resultados

#### 1.2 Integração Catálogo → Calculadora

- Impressoras e materiais adicionados no Catálogo devem aparecer nos selects da calculadora
- `calculatorStore.selectedPrinter` deve aceitar qualquer entrada de `catalogStore.printers`
- Mesma integração para materiais: ao trocar no Catálogo, refletir no select da calculadora

#### 1.3 Integração Inventário → Calculadora

- Botão "Usar neste cálculo" em cada carretel do Inventário
- Ao clicar: preenche automaticamente `fdmMaterial.costPerKg` e `fdmMaterial.materialType` na calculadora
- Após cálculo: botão "Deduzir peso estimado" no ResultsPanel para descontar do carretel ativo

#### 1.4 Carregar histórico de volta na calculadora

- Botão "Recarregar" em cada item do HistoryTab
- Restaura todos os valores de store (`fdmMaterial`, `fdmPrintParams`, etc.) do snapshot salvo
- Navega automaticamente para a aba Calculadora

#### 1.5 Diálogos de confirmação sem `confirm()` nativo

- Criar componente `<ConfirmDialog>` com glass morphism
- Substituir todos os `confirm(...)` da aplicação por esse componente
- Suportar título, descrição e botões de ação customizáveis

---

### Fase 2 — Histórico & Dashboard Evoluídos

> **Meta:** Transformar dados salvos em inteligência acionável.

#### 2.1 Histórico unificado

- Mesclar `calculatorStore.history` (snapshot rápido no ResultsPanel) com `productStore` (HistoryTab)
- Uma única fonte de verdade: `historyStore` com persistência completa
- O ResultsPanel usa esse store para exibir o mini-histórico e o HistoryTab para a lista completa

#### 2.2 Ordenação e filtros no HistoryTab

- Filtro por tipo (FDM / Resina)
- Ordenação por: data ↑↓ · preço de venda ↑↓ · lucro ↑↓ · nome A-Z
- Pill de filtro ativo com botão "Limpar filtros"

#### 2.3 Comparativo de registros

- Checkbox em cada item do histórico para selecionar até 2 registros
- Botão "Comparar selecionados" → abre modal com tabela lado a lado
- Diferenças destacadas em verde (melhor) / vermelho (pior)

#### 2.4 Dashboard persistente e enriquecido

- Persistir `printsPerMonth`, `buyPrice`, `targetSellPrice` no `localStorage`
- Novo card: **Break-even** — exibe quantas unidades precisam ser vendidas para cobrir o custo fixo mensal (máquina + energia + software)
- Gráfico de linha: lucro médio dos últimos N cálculos salvos (usa `historyStore`)
- Card de **Margem média** calculada sobre todos os itens no histórico

#### 2.5 Import JSON no HistoryTab

- Botão "Importar JSON" que aceita arquivo gerado pelo próprio Export
- Merge inteligente: não duplica registros com mesmo `id`

---

### Fase 3 — Usabilidade & Experiência

> **Meta:** Polir a experiência para que o app seja autoexplicativo e rápido de usar.

#### 3.1 Onboarding para novos usuários

- Detectar primeira visita via `localStorage`
- Modal de boas-vindas com 3 slides: "O que é", "Como calcular", "Como salvar"
- Botão "Pular" persistente

#### 3.2 Tooltips informativos

- Ícone `ⓘ` em campos com lógica não-óbvia:
  - **Taxa de falha** — "% estimada de impressões descartadas"
  - **Quick Mode** — "Usa valores padrão para máquina, energia e mão de obra"
  - **Vida útil da máquina** — "Horas estimadas de operação até depreciação total"
  - **Break-even** — explicação de como o valor é calculado
- Tooltips com delay de 400ms, posicionados via Floating UI / Popper

#### 3.3 Inventário — Edição e dedução livre

- Ícone de lápis em cada carretel → formulário inline de edição
- Campo de input livre para dedução de peso (`X gramas`)
- Filtro por material e marca (pills clicáveis no topo)

#### 3.4 Catálogo — Edição inline

- Ícone de lápis em cada card de impressora/material/marketplace
- Edição inline com `<input>` substituindo o texto, confirmação com Enter ou blur
- Somente campos editáveis (`power`, `value`, `price`, `feePercent`, etc.)

#### 3.5 Atalhos de teclado

- `Ctrl/Cmd + S` → salvar configurações
- `Ctrl/Cmd + H` → navegar para Histórico
- `Ctrl/Cmd + D` → navegar para Dashboard
- `Escape` → fechar qualquer modal aberto
- Indicador de atalho visível em tooltips dos botões principais

---

### Fase 4 — Qualidade & Infraestrutura

> **Meta:** Garantir que o produto não quebre ao escalar e seja confiável.

#### 4.1 Testes unitários — calculator.ts

- Cenários: FDM básico, Resina básica, seções desabilitadas, margem zero, custo zero
- Cobertura mínima de 80% em `calculator.ts`
- Rodar em CI com `vitest`

#### 4.2 Testes de integração — stores

- Testar `calculatorStore`: toggle de seção afeta resultado
- Testar `historyStore`: add, remove, merge, export, import
- Testar `filamentInventory`: addSpool, deductWeight, getLowStock

#### 4.3 Error Boundaries

- `<ErrorBoundary>` envolvendo `<ResultsPanel>`, `<Dashboard>` e `<StlPreview>`
- Fallback amigável com opção de "Resetar calculadora"

#### 4.4 Performance — Memoization

- Auditar `useCalculatorStore` para evitar re-renders desnecessários
- `useMemo` em `chartData` (já existe em alguns lugares, verificar cobertura)
- Lazy load de `pdfExport` e `csvExport` (já feito) — verificar `StlPreview` e `recharts`

#### 4.5 PWA & Offline

- Revisar service worker — garantir que o app funciona 100% offline
- Adicionar notificação de "Nova versão disponível" com botão de atualizar

---

## 📊 Matriz de Prioridade

```
                IMPACTO
                Alto         Médio        Baixo
        ┌─────────────────────────────────────────┐
  Alta  │  1.2 Catálogo   2.1 Histórico  3.2 Tooltips  │
        │  1.3 Inventário 2.2 Filtros    3.5 Atalhos   │
        │  1.4 Carregar   2.4 Dashboard               │
        ├─────────────────────────────────────────┤
  Média │  1.5 Dialogs    3.1 Onboarding 3.3 Inventário│
        │  1.1 Auto-save  2.3 Compare    3.4 Catálogo  │
        ├─────────────────────────────────────────┤
  Baixa │  4.3 Boundaries 4.1 Testes     4.5 PWA      │
        │  4.4 Perf.      4.2 Int. tests 2.5 Import   │
        └─────────────────────────────────────────┘
  ESFOR
  ÇO
```

---

## 🏷️ Status

### ✅ Concluído (Fase 1 + parte da Fase 2)

- **Sistema Multi-Moeda** — BRL/USD/EUR/GBP com auto-detecção, seletor no header, hook `useCurrency` unificado
- **Seção de Falhas** — toggle, modo percentual/fixo, valor, risk multiplier com UI completa
- **Custos Fixos Mensais** — seção na calculadora, integrado ao cálculo de custo por hora
- **StoreBridge** — orquestração entre catálogo, inventário, calculadora e histórico
- **Catálogo → Calculadora** — impressoras, materiais e marketplaces customizados aparecem nos selects
- **Inventário → Calculadora** — selecione carretéis para preencher tipo e custo/kg
- **Inventário Reformulado** — SVG spool icons, busca, filtros, edição, status badges, paleta de cores
- **Histórico Unificado** — historyStore com persistência, calculatorStore usa o mesmo store
- **Carregar do Histórico** — restore completo do snapshot na calculadora
- **Ordenação e Filtros no HistoryTab** — filtro por tipo, ordenação por data/preço/lucro/nome, busca
- **Auto-save** — formulário salvo a cada 800ms + beforeunload
- **ConfirmDialog** — componente modal estilizado substituindo `confirm()` nativo
- **Exportar Cotação** — botão no ResultsPanel com JSON de cotação
- **Estimador de Tempo via STL** — tempo de impressão estimado ao carregar 3D
- **AMS Multi-material** — suporte a impressoras multifilamento com até 4 slots
- **Responsividade** — grids 2 itens/linha, padding reduzido, unidades fora dos inputs
- **UX** — modo rápido reposicionado, headers sem toggle, seções colapsáveis

### 📋 Pendente (Fase 2 + Fases 3 e 4)

- **T-003: Dedução Automática de Estoque** — botão "Deduzir do Estoque" no ResultsPanel
- **T-006: Comparativo de Registros** — modal lado a lado com diferenças destacadas
- **T-007: Dashboard Persistente** — break-even chart, gráfico de tendência, margem média
- **T-010: Import JSON** — botão de import no HistoryTab
- **Fase 3: Usabilidade** — onboarding, tooltips, edição inline catálogo, atalhos teclado
- **Fase 4: Qualidade** — testes unitários/integração, error boundaries, PWA, performance

| Item                                | Status                               |
| ----------------------------------- | ------------------------------------ |
| Fase 1 — Fundação & Quick Wins      | ✅ Concluída                         |
| Fase 2 — Histórico & Dashboard      | 🟡 Parcial (2.3, 2.4, 2.5 pendentes) |
| Fase 3 — Usabilidade & Experiência  | 📋 Planejado                         |
| Fase 4 — Qualidade & Infraestrutura | 📋 Planejado                         |

> Atualizado em: 25 de Maio de 2026
