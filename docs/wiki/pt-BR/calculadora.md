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
2. **Por quanto ela deve ser vendida?** Sobre o custo de produção você aplica a
   margem, os impostos e as taxas de marketplace — e o preço de venda aparece
   ao lado do custo, nunca sozinho.

Manter essas duas contas separadas é o que transforma a margem em uma **escolha
consciente**. Quando custo e preço de venda são apresentados lado a lado, você
decide se quer ganhar mais ajustando a margem ou reduzindo um custo real.

## Três níveis de detalhe

Nem todo orçamento precisa de todas as seções. Por isso a calculadora tem três
níveis, e cada um revela mais seções:

- **Rápido** — quatro seções: `material`, `print`, `sales` e `results`. É o
  suficiente para uma estimativa em 30 segundos.
- **Detalhado** — adiciona a seção `failure`, para quem já tem um histórico de
  perdas e quer precificá-lo.
- **Completo** — revela todas as dez seções, incluindo `hardware`, `machine`,
  `fixedCost`, `labor` e `ops`. Controle total sobre cada parâmetro.

A lógica é gradual: o nível **Rápido** cobre o caminho do filamento ao preço de
venda; o **Detalhado** acende a contabilidade de falhas; o **Completo** abre a
planilha inteira.

**Mudar de nível não apaga nada.** Os campos que você já preencheu continuam
lá, guardados no estado da calculadora — você só deixa de ver as seções que o
nível atual esconde. Pode começar no Rápido para fechar um preço rápido e subir
de nível depois, quando precisar de precisão.

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

preço de venda    = custo total + margem
                  + impostos e taxas de marketplace
```

Note que `sales` é a única seção que **não é custo**: embalagem e frete somam
ao total, mas margem, impostos e taxas são aplicados **por cima** dele. Por
isso o preço de venda cresce de forma diferente do custo — e por isso a seção
`results` existe, para mostrar essa diferença com clareza.

## Um exemplo completo

Uma peça decorativa em PLA, 50 g, 5 horas de impressão, margem de 100%:

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
5. **Ajuste a seção `sales`** — a margem é o seu lucro declarado. Suba ou
   desça conforme o mercado; o preço de venda se atualiza na hora.
6. **Suba de nível** se precisar: ative `failure` para incluir perdas, ou vá ao
   Completo para ratear máquina, mão de obra e custos fixos.
7. **Salve ou exporte** — a estimativa vira produto no inventário ou item de
   orçamento, e o histórico guarda os números para a próxima peça.

## Por onde começar

Se você nunca usou a calculadora, faça assim: abra no nível **Rápido**, preencha
só `material` e `print`, e olhe o `results`. Esse já é um orçamento honesto. A
maior parte dos erros de precificação não acontece por falta de seções —
acontece por margem aplicada sem saber o custo. Comece pelo custo, deixe as
seções avançadas para quando elas passarem a fazer diferença no seu bolso.
