---
title: Calculadora
order: 1
tourId: calc-basico
---

# Calculadora

A **Calculadora** é o núcleo do Open3DCalc. Ela estima o custo de uma impressão 3D
a partir de poucos dados de entrada e divide o resultado em **seções auditáveis**:
você vê exatamente quanto cada parte contribui no total, sem caixas-pretas.

A filosofia é simples: **custo é uma soma, não um palpite**. Cada número que
aparece na tela tem uma origem rastreável — um campo que você preencheu e uma
fórmula conhecida. Se o preço final parece alto, a calculadora te mostra qual
seção está pesando, em vez de esconder o problema dentro de um "valor total".

## O que ela calcula

A calculadora responde a duas perguntas separadas, sempre na ordem:

1. **Quanto esta peça custa para existir?** É a soma de tudo que você consome
   para produzi-la: material, energia, desgaste da máquina, mão de obra,
   falhas e os custos fixos da oficina.
2. **Por quanto ela deve ser vendida?** Sobre o custo de produção você aplica o
   markup, os impostos e as taxas de marketplace — e o preço de venda aparece
   ao lado do custo, nunca sozinho.

Manter essas duas contas separadas é o que transforma a margem em uma **escolha
consciente**. Quando custo e preço de venda são apresentados lado a lado, você
decide se quer ganhar mais ajustando a margem ou reduzindo um custo real.

## Layouts disponíveis

A beta 3 oferece três layouts implementados para a mesma calculadora:

- **Clássico** — a calculadora completa, organizada em seções, com navegação e
  controle de nível no topo. É o caminho para uma visão completa e para quem já
  conhece o fluxo de trabalho.
- **Guided (Fluxo Guiado)** — uma sequência de perguntas, passo a passo, para
  quem está começando e para o uso no celular. Ele conduz a estimativa sem
  expor todas as seções de uma vez.
- **Bento Grid** — cinco cards organizados em uma grade responsiva. Ele não é mais
  um painel somente informativo: agora é uma calculadora editável, com os mesmos
  campos do Classic, e os cards alimentam o cálculo real.

O seletor de layout fica no cabeçalho e a preferência é lembrada pelo aplicativo.
O modo Farm está no roadmap e não está disponível nesta beta; não há um quarto
layout para usar.

## Nível de detalhe: Rápido, Detalhado e Completo

O seletor **Rápido / Detalhado / Completo** aparece no topo do Classic e do
Bento. É o mesmo componente e o mesmo estado nos dois layouts: mudar o nível em
um deles reflete imediatamente no outro.

- **Rápido** — mostra `material`, `print`, `sales` e `results`, o caminho mínimo
  para uma estimativa rápida.
- **Detalhado** — acrescenta a seção `failure`, para quem quer incluir perdas e
  retrabalho.
- **Completo** — libera todas as dez seções, incluindo `hardware`, `machine`,
  `fixedCost`, `labor` e `ops`.

A visibilidade é regida pelo contrato
`isFieldVisibleForLevel(calcLevel, hiddenFields, sectionId, fieldId)`. Ele é
compartilhado pelo Classic e pelo Bento e também respeita `hiddenFields`, ou
seja, as escolhas de campos ocultos não são descartadas ao trocar de layout.

**Mudar de nível não apaga valores.** Os campos preenchidos continuam guardados;
apenas as seções ou os campos que o nível atual oculta deixam de aparecer. Você
pode começar no Rápido e aumentar o detalhe quando precisar.


## O mapa das dez seções

Cada seção é um bloco independente que calcula uma parte do total. Esta é a
função de cada uma:

- [**material**](#user-content-material) — quanto de filamento ou resina a peça
  consome, e quanto isso custa.
- [**print**](#user-content-parâmetros-de-impressão) — o tempo de impressão e a energia gasta na
  máquina.
- [**failure**](#user-content-risco-e-falhas) — falhas e retrabalho transformados em
  custo, por percentual ou valor fixo.
- [**hardware**](#user-content-desgaste-de-hardware) — desgaste do bico, da mesa de
  impressão e do LCD (em resina).
- [**machine**](#user-content-custos-da-máquina) — depreciação da impressora e manutenção,
  rateadas por hora de uso.
- [**fixedCost**](#user-content-custos-fixos) — aluguel, internet e energia base da
  oficina, distribuídos por hora produtiva.
- [**labor**](#user-content-mão-de-obra) — tempo de setup e pós-processamento
  multiplicado pela sua taxa horária.
- [**ops**](#user-content-operacional--software) — EPI, licença do slicer, arquivo de modelo e
  outros insumos operacionais.
- [**sales**](#user-content-custos-adicionais-e-vendas) — embalagem, frete, impostos, marketplace e a
  sua margem: é a seção que monta o preço de venda.
- [**results**](#user-content-resultados) — consolida tudo e mostra custo, lucro e
  preço final lado a lado.

Todas as dez seções deste mapa têm artigo próprio na Wiki, com a fórmula
completa e exemplos numéricos — é só seguir os links acima. E a seção
[results](#user-content-resultados) mostra a soma de todas elas lado a lado.

## A fórmula-mestre

Tudo o que a calculadora faz cabe em três linhas. O custo de produção soma as
seções de consumo; o custo total acrescenta falhas e logística; e o preço de
venda aplica a margem e os impostos sobre essa base:

```
custo de produção = material + print + hardware + machine
                  + fixedCost + labor + ops

custo total       = produção + failure + embalagem + frete

preço de venda    = custo total + markup
                  + impostos e taxas de marketplace
```

Note que `sales` é a única seção que **não é custo**: embalagem e frete somam
ao total, mas margem, impostos e taxas são aplicados **por cima** dele. Por
isso o preço de venda cresce de forma diferente do custo — e por isso a seção
`results` existe, para mostrar essa diferença com clareza.

## Regras que evitam números enganosos

### Margem real x markup

O campo `profitMarginPercent` representa **markup sobre o custo**, não a
percentagem final do lucro sobre o preço. Por exemplo, `110%` de markup significa
que o preço deve ser `2,10 ×` o custo: um custo de `R$ 100,00` vira
`R$ 210,00`, com `R$ 110,00` de lucro.

A **margem real** é derivada e somente-leitura:

```
margem real = lucro ÷ preço de venda × 100
```

Nesse exemplo, `R$ 110,00 ÷ R$ 210,00 = 52,38%`. O valor aparece em cinco pontos
da interface para ficar visível perto do preço. O tooltip da interface resume a
diferença: “Markup: lucro sobre o custo. Margem: lucro sobre o preço que o
cliente paga.” Consulte também [Vendas](#user-content-custos-adicionais-e-vendas)
e [Resultados](#user-content-resultados).

### Ausência não é zero

Na beta 3, `R$ 0,00` nunca mais significa que o cálculo terminou em zero. Um
valor não-finito é mostrado como `—`, e não como uma quantia inventada.

Isso corrige um caso real: ao restaurar um cálculo antigo, o campo
`energyCostPerKwh` podia estar ausente. O `NaN` percorria a cadeia de
cálculo e a tela acabava mostrando `R$ 0,00`, parecendo um custo válido. Agora a
regra é:

- **Ausência em um snapshot legado:** o app usa o default da aplicação para o
  campo que falta e tenta concluir o cálculo.
- **Corrupção ou valor inválido:** `NaN`, negativo, tipo errado ou divisão por
  zero geram um erro explícito, com o caminho do campo exato.
- **Resultado não-finito:** a interface exibe `—` e o aviso de cálculo
  inválido; não transforma o problema em zero.

A validação acontece antes do cálculo em sete caminhos: carga inicial,
`loadHistoryItem`, `undo`, `restoreAutoSnapshot`, `loadSharedCalculation`,
setters e `setWithCompute`. Isso mantém a regra para abrir, desfazer, restaurar,
compartilhar e editar valores.

Quando aparecer `—`, leia o nome do campo indicado no alerta e corrija esse
campo. Se o erro veio de um histórico ou de um cálculo compartilhado, restaure
uma configuração válida ou preencha o valor ausente antes de usar o resultado.
Não compense um valor desconhecido com `0`: nesse caso o app ainda não tem um número
confiável para a peça.

### Presets de demonstração removidos

Os três presets de demonstração — **Vaso**, **Suporte GoPro** e **Estatueta** —
foram removidos. Eles preenchiam peso e tempo inventados; esses dados são
propriedade do modelo e não do fluxo de cálculo, portanto um preset não deve
fingir que conhece a peça.

Para ver o funcionamento, use o **Modo Demo**, que é explicitamente uma
demonstração. Para trabalhar com uma configuração real, calcule a peça e
carregue-a do **Histórico**.

### Multi-material temporariamente desativado

O suporte a múltiplos materiais está desativado nesta beta. O toggle continua
visível, mas fica indisponível e explica que o modelo completo virá em uma fase
própria. O motivo é objetivo: o custo dos slots substituía apenas
`materialCost`; `subtotal`, `totalCost`, `sellPrice` e `profit` não recebiam
essa parcela, deixando o preço subestimado em silêncio.

Não use um valor parcial de multi-material para fechar um orçamento. O campo
`fdmAmsSlots` é preservado para essa fase futura, mas não representa hoje um
modelo de custo completo.

## Controles e apresentação

O controle de personalização de campos agora aparece uma única vez, no
componente `FieldCustomizer`. Antes o mesmo ajuste era repetido de duas a
quatro vezes em seções diferentes. `SectionHeader` é apenas apresentacional;
ele não mantém uma segunda cópia do estado. O nível de detalhe e
`hiddenFields` continuam sendo a fonte única de verdade para o Classic e o
Bento.

A interface usa **Plus Jakarta Sans auto-hospedada** em WOFF2, sob a licença
OFL 1.1. A fonte anterior do Google era bloqueada pela CSP, então o app não
depende dela para exibir a Wiki. O arquivo `tokens.css` é a fonte única dos
tokens visuais, com os mesmos valores semânticos para os temas claro e escuro.

A Wiki também preserva a acessibilidade ao navegar entre artigos: o destino é
rolado e recebe foco antes da interação seguinte. A correção usa
`useLayoutEffect` no lugar de `useEffect`, evitando que o foco seja aplicado
antes da montagem do título.

## Um exemplo completo

Uma peça decorativa em PLA, 50 g, 5 horas de impressão, markup de 100%:

```
material    50 g a R$ 125/kg (eficiência 98%)  = R$  6,38
print       5 h a 250 W, R$ 0,80/kWh           = R$  1,00
machine + hardware + labor + ops (exemplo)    = R$  3,00
                              custo de produção = R$ 10,38
failure     10% de retrabalho                  = R$  1,04
embalagem + frete                             = R$  3,00
                                    custo total = R$ 14,42
margem      100% sobre o custo total          = R$ 14,42
impostos + marketplace (25%)                  = R$  9,61
                              preço de venda  = R$ 38,45
```

A matemática dos impostos é explicada no artigo [sales](#user-content-custos-adicionais-e-vendas); o
importante aqui é ver que cada linha tem origem em uma seção. Se o cliente
acha caro, você sabe exatamente onde está o R$ 14,42 de custo e pode agir sobre
ele — e não sobre o preço às cegas.

## Fluxo de uso

O caminho recomendado, do primeiro número ao preço final:

1. **Escolha o nível** e a aba (FDM ou resina). Comece no Rápido se estiver com
   pressa; o nível não trava nada para depois.
2. **Preencha a seção `material`** com tipo, custo por kg e peso da peça. Se
   o filamento está catalogado no inventário, selecionar o carretel preenche os
   valores automaticamente.
3. **Preencha a seção `print`** com o tempo do fatiador, a potência da
   impressora e o custo do kWh.
4. **Olhe a seção `results`** — ela já mostra um custo e um preço de venda
   com a margem padrão.
5. **Ajuste a seção `sales`** — o markup é o lucro declarado sobre o custo. Suba ou
   desça conforme o mercado; o preço de venda se atualiza na hora.
6. **Suba de nível** se precisar: ative `failure` para incluir perdas, ou vá ao
   Completo para ratear máquina, mão de obra e custos fixos.
7. **Salve ou exporte** — a estimativa vira produto no inventário ou item de
   orçamento, e o histórico guarda os números para a próxima peça.

## Armadilhas comuns

Quatro erros cercam quem está começando com a calculadora, e todos eles se disfarçam de pressa.

- **Aplicar markup sem saber o custo.** O preço de venda se atualiza na hora quando você
  mexe na porcentagem, o que convida ao ajuste às cegas. Sem olhar o `results` lado a lado,
  100% de markup parece 100% de lucro — e não é.
- **Somar a margem e esquecer o que vem por cima.** Custo total mais margem dá R$ 28,84 no
  exemplo; o preço de venda é R$ 38,45. Os R$ 9,61 de diferença são impostos e marketplace,
  aplicados por cima do total, e não são lucro.
- **Começar no nível Completo.** O Rápido cobre o caminho do filamento ao preço de venda com
  quatro seções, e mudar de nível depois não apaga nada. Quem abre as dez seções de uma vez se
  afoga em campos antes de fechar o primeiro preço.
- **Tratar `sales` como mais um custo.** Embalagem e frete somam ao total; margem, impostos e
  taxas são aplicados por cima dele. Confundir soma com aplicação faz o preço crescer na
  proporção errada.

## Por onde começar

Se você nunca usou a calculadora, faça assim: abra no nível **Rápido**, preencha
só `material` e `print`, e olhe o `results`. Esse já é um orçamento honesto. A
maior parte dos erros de precificação não acontece por falta de seções —
acontece por margem aplicada sem saber o custo. Comece pelo custo, deixe as
seções avançadas para quando elas passarem a fazer diferença no seu bolso.
