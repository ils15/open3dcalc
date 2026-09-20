---
title: Custos Fixos
order: 15
---

# Custos Fixos

A seção **Custos Fixos** responde a uma pergunta incômoda: *o que esta peça
paga do aluguel?* Tudo que você gasta por mês mesmo que a impressora fique
desligada — aluguel da oficina, internet, energia da base, condomínio, taxa de
software obrigatório. Nenhuma peça usa essas coisas sozinha, mas todas precisam
delas para existir.

Esta seção só aparece no nível **avançado**. É, de longe, a seção mais
subestimada da calculadora e a que mais separa um hobby de um negócio de
verdade.

## Por que ratear e não ignorar

O argumento contra esta seção é: *"o aluguel eu pago de qualquer jeito"*. É
verdade, e é exatamente por isso que ele precisa estar no preço. Se nenhuma
peça paga o aluguel, então é o seu salário — ou a sua poupança — que está
cobrindo o aluguel do negócio. O cliente sai com uma peça barata e você sai
pagando o espaço onde ela foi feita.

O rateio resolve isso com uma ideia simples: o custo mensal é dividido pelas
horas produtivas do mês, e cada peça paga a parte das horas que ela usou. Peça
alguma que use mais horas, paga mais aluguel. Justo.

## Campos da seção

A seção é enxuta de propósito — dois campos e um interruptor.

- **Custo Fixo Mensal** — a soma de tudo que você paga por mês independente da
  produção. Aluguel, internet, energia base, manutenção predial, software com
  assinatura obrigatória. Veja a armadilha abaixo sobre o que não colocar aqui.
- **Horas por Mês** — as **horas produtivas** estimadas da impressora por mês,
  a mesma ideia do campo [uso mensal](#user-content-custos-da-máquina). Se este campo
  ficar em zero, a divisão é protegida e o rateio vira zero — o que significa
  que nenhuma peça está pagando o aluguel.

## A fórmula

A conta é a mais simples da calculadora, e talvez por isso seja a mais
ignorada:

```
rateioPorHora = custoFixoMensal / horasProdutivasMes

fixedCost = rateioPorHora * tempoImpressaoHoras
```

O resultado não é somado como uma linha separada: ele é injetado na **taxa
horária da máquina**, na seção [máquina](#user-content-custos-da-máquina). Assim, o
rateio acompanha as horas de impressão de cada peça — peça longa, mais aluguel.

## Exemplo numérico passo a passo

Uma oficina pequena em um quarto transformado em estúdio:

```
aluguel + condomínio     = R$ 450
internet                 = R$ 60
energia base (standby)   = R$ 40
-------------------------
custoFixoMensal          = R$ 550

horasProdutivasMes       = 150 h

rateioPorHora = 550 / 150 = R$ 3,67/h
```

Nossa peça-exemplo, o suporte de celular com **5,5 horas** de impressão:

```
fixedCost = 3,67 * 5,5 = R$ 20,18
```

A peça carrega **R$ 20,18** de aluguel, internet e energia base. Compare com os
R$ 16,20 de [material](#user-content-material): a peça paga mais aluguel do que
filamento. É esse o momento em que muita gente descobre que o preço de venda
estava cobrando só o plástico.

## A sensibilidade que assusta

O rateio é uma divisão — e divisões explodem quando o denominador é pequeno.
Veja a mesma oficina com diferentes horas produtivas:

```
150 h/mês → 550 / 150 = R$ 3,67/h
100 h/mês → 550 / 100 = R$ 5,50/h
 50 h/mês → 550 /  50 = R$ 11,00/h
```

Se a impressora passa a semana parada, cada peça precisa carregar o dobro ou o
quádruplo do aluguel. Isso não é um defeito do cálculo: é a realidade de uma
operação subutilizada. A saída é ou ocupar a máquina ou aceitar que peças
avulsas de fim de semana têm um preço justo mais alto.

## Como esta seção se relaciona com as demais

- O rateio é aplicado na taxa horária da [máquina](#user-content-custos-da-máquina),
  junto com a depreciação e a manutenção.
- As horas que você usa aqui devem ser **as mesmas** do uso mensal da
  [máquina](#user-content-custos-da-máquina). Usar 150 h aqui e 300 h lá é
  autoengano: o rateio sai pela metade.
- A **energia da impressão** (diferente da energia base) é contada na seção de
  [parâmetros](#user-content-parâmetros-de-impressão); não a duplique aqui.
- A **manutenção do equipamento** fica na [máquina](#user-content-custos-da-máquina);
  aqui fica a manutenção do **espaço**.

## Armadilhas práticas

1. **Colocar custos variáveis aqui.** Filamento, agulha, isopropílico e frete
   são proporcionais à produção — já têm sua própria seção. Aqui entra só o que
   é fixo: se dobra ou zerou a produção, o valor não muda.
2. **Horas produtivas otimistas.** Se a máquina fica ligada 12 horas por dia mas
   só imprime 4, são 4 as horas produtivas. Superestimar este campo é a forma
   mais comum de baratear artificialmente o próprio preço.
3. **Esquecer os custos invisíveis.** Internet, software de assinatura, taxa de
   cartão da maquininha, estacionamento. Ninguém lembra de cobrar R$ 60 de
   internet — sobre cem peças por mês, são R$ 0,60 por peça que ninguém pagou.
4. **Não ratear quando imprime pouco.** Quem faz duas peças por mês costuma
   zerar esta seção por achar injusto cobrar R$ 40 de aluguel em uma peça. Mas
   o aluguel é real: ou está no preço, ou está no seu bolso.
