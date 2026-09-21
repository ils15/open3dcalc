---
title: Risco e Falhas
order: 12
---

# Risco e Falhas

A seção **failure** existe porque uma peça falhada não é um acidente — é um
custo. Toda impressão que dá errado consome filamento, energia e horas de
máquina que não geram venda nenhuma. Quem vende peça sem incluir essa perda no
preço está pagando do próprio bolso por cada falha.

A seção é **opcional por design**: ela fica desativada no nível **Rápido** e
aparece a partir do **Detalhado**, porque ela só faz sentido para quem já
produziu o suficiente para ter uma noção real da sua taxa de perda. Se você
imprime esporadicamente, o custo de falha pode ser zero; se vende centenas de
peças por mês, ignorá-lo é prejuízo certo.

## Os campos

A seção inteira se resume a quatro campos, e cada um controla uma parte da conta.

- **Ativar custo de falha** — a seção inteira é ligada ou desligada por um
  interruptor. Desligada, ela não soma nada, e o resto do cálculo não muda.
- **Modo de falha** — como a perda é medida: **Percentual** (uma taxa sobre o
  custo de produção) ou **Fixo** (um valor em reais por peça).
- **Valor da falha** — no modo percentual, a porcentagem esperada de perda; no
  modo fixo, o custo de cada falha. Dez por cento é um bom ponto de partida
  para começar.
- **Multiplicador de risco** — um fator aplicado sobre a taxa de falha para
  cenários mais arriscados (peças grandes, materiais difíceis, primeira vez num
  modelo novo).

## Como o cálculo funciona

No modo **fixo**, a lógica é direta: o valor da falha é somado ao custo de cada
peça, sem surpresa.

```
custo de falha (fixo) = valor da falha
```

No modo **percentual**, a taxa é aplicada sobre o **custo de produção** — a
soma de material, energia, máquina, hardware, mão de obra e operação, antes de
embalagem e frete. O multiplicador de risco, quando existe, altera a taxa antes
 dela ser aplicada:

```
taxa ajustada     = valor da falha * multiplicador de risco
custo de falha    = custo de produção * (taxa ajustada / 100)
```

A ordem importa: a falha incide sobre o que a peça **consumiu de verdade**, e
não sobre o preço final. Assim, uma falha de 10% sobre um custo de produção de
R$ 20,00 é R$ 2,00 — e não 10% de um preço de venda inflado.

## Exemplo numérico

Suponha uma peça com R$ 20,00 de custo de produção e uma taxa de falha de 10%:

```
custo de falha = 20,00 * (10 / 100) = R$ 2,00
```

Cada peça que você entrega carrega R$ 2,00 das que deram errado. Agora o mesmo
print num cenário de risco alto — um modelo grande que você nunca imprimiu,
com multiplicador de risco de 1,5:

```
taxa ajustada  = 10 * 1,5           = 15%
custo de falha = 20,00 * (15 / 100) = R$ 3,00
```

A diferença é o multiplicador fazendo o seu trabalho: ele te obriga a reconhecer
que um print arriscado custa mais que um print rotineiro. Se a peça sair de
primeira, você ganhou os R$ 3,00; se falhar, eles já estavam no preço.

No modo **fixo**, a mesma peça com um custo de R$ 4,00 por falha simplesmente
soma R$ 4,00 ao custo de cada peça entregue — útil quando você conhece o valor
médio de uma tentativa perdida e prefere trabalhar com um número em reais.

## De onde vem a sua taxa

Não existe taxa universal — a sua vem do seu próprio histórico. Algumas
referências práticas:

- **Iniciante em FDM, peças simples**: 5–10%. PLA é tolerante e modelos pequenos
  raramente falham.
- **Peças técnicas ou altas**: 15–20%. Mais tempo de máquina significa mais
  exposição a um problema no meio do print.
- **Resina**: costuma ser maior. A peça pode falhar na impressão, na lavagem ou
  na cura — três etapas em vez de uma.
- **Modelo novo ou cliente exigente**: use o multiplicador de risco. A primeira
  unidade de qualquer série tem uma taxa de perda muito maior que a décima.

O lugar certo para descobrir a sua taxa é o **histórico** de peças que você já
fez, não um palpite. Se você registrou suas tentativas, divida as que falharam
pelo total e terá o número para pôr no campo.

## Armadilhas comuns

Quatro erros cercam esta seção, e todos eles fazem a perda sair do seu bolso, não do preço.

- **Manter a falha desligada "para baratear".** Ela não torna o preço mais
  competitivo — apenas transfere a perda do cliente para você. Quando a falha
  inevitavelmente acontece, saiu do seu lucro.
- **Aplicar a taxa sobre o preço de venda.** A falha é proporcional ao custo de
produção, não ao preço. Usar a base errada dobra o valor e infla o preço.
- **Ignorar o multiplicador em prints grandes.** Uma peça de 30 horas não tem a
  mesma taxa de risco de uma de 30 minutos; o multiplicador existe justamente
  para esses casos.
- **Taxa de 0%.** Só é honesto se você realmente nunca perde uma peça. Mesmo
  quem imprime há anos tem perdas esporádicas — 5% já cobre a maioria delas.
