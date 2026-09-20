---
title: Mão de Obra
order: 16
---

# Mão de Obra

A seção **Mão de Obra** responde a: *quanto vale o meu tempo nesta peça?* São
os minutos em que um ser humano está de fato trabalhando: preparando o arquivo,
fatiando, configurando a impressora, descolando a peça, removendo suporte,
lixando.

Esta seção só aparece no nível **avançado**. É a seção que separa quem custeia
o próprio tempo de quem trata a própria hora como de graça.

## O que NÃO entra aqui: o tempo de impressão

Este é o ponto mais importante da seção, e a fonte do erro mais comum: **o
tempo que a impressora passa imprimindo não é mão de obra**. Durante essas
horas a máquina trabalha sozinha e você pode estar fazendo outra coisa — ou
outro trabalho remunerado. O tempo de impressão é cobrado pela
[máquina](#user-content-machine) (depreciação, energia, rateio), não por aqui.

Se você somar as 5,5 horas de impressão na mão de obra, o cliente paga o dobro:
uma vez como máquina, uma vez como gente. A mão de obra conta só os minutos em
que **você** é necessário.

## Campos da seção

- **Setup (Fatiamento)** — minutos gastos preparando o arquivo: ajustar o
  modelo, posicionar a chapa, configurar o fatiador, exportar o gcode, nivelar
  a mesa e carregar o filamento. Em uma peça simples são 5 minutos; em um
  arquivo de cliente com várias revisões, podem ser 40.
- **Pós-Processamento** — minutos retirando a peça da mesa, removendo suportes,
  lixando, colando, pintando. Esse tempo é proporcional a cada peça.
- **Valor Hora** — quanto você quer ganhar por **hora** de trabalho, em reais.
  É o campo mais deixado em zero. Se estiver em zero, esta seção inteira soma
  zero — e você doa o próprio tempo.

## A fórmula

Minutos viram horas e multiplicam pelo valor hora:

```
totalMinutos = setupMinutos + posProcessamentoMinutos

labor = (totalMinutos / 60) * valorHora
```

Quando você produz mais de uma unidade idêntica, o app dilui a mão de obra
entre as unidades — o setup é compartilhado pelo lote todo:

```
laborPorUnidade = labor / quantidade
```

Veja a armadilha abaixo sobre o pós-processamento nessa diluição.

## Exemplo numérico passo a passo

Nossa peça-exemplo, o suporte de celular. Você levou 12 minutos configurando o
fatiador e 18 minutos descolando e lixando a peça, e quer ganhar **R$ 25 por
hora**.

```
totalMinutos = 12 + 18 = 30 min

labor = (30 / 60) * 25 = 0,5 * 25 = R$ 12,50
```

Por trás do número: **R$ 5,00** de setup (0,2 h × 25) e **R$ 7,50** de
pós-processamento (0,3 h × 25). Agora o mesmo cenário com um lote de 10
unidades:

```
labor = 12,50 / 10 = R$ 1,25 por unidade
```

Na prática, o setup de 12 minutos foi pago uma vez e rateado. Já os 18 minutos
de lixamento acontecem de novo em cada peça — por isso o lote merece atenção.

## Quanto cobrar de valor hora

Não existe resposta única, mas existe um piso: o seu valor hora precisa cobrir
o que a hora custa para você, não só o que ela "vale no mercado". Some o que
você gasta por mês (incluindo o que está nas seções
[custos fixos](#user-content-fixedCost) e [máquina](#user-content-machine)) e
divida pelas horas que você de fato trabalha no negócio. Qualquer valor abaixo
disso é trabalho de graça.

```
pisoValorHora = custoMensalTotal / horasTrabalhadasMes
```

R$ 25/h é um começo honesto para uma operação de uma só pessoa; R$ 8/h é
trabalho escravo subsidiado por outra fonte de renda.

## Como esta seção se relaciona com as demais

- O **tempo de impressão** (que NÃO está aqui) vem de
  [parâmetros](#user-content-print) e alimenta [máquina](#user-content-machine).
- Os **insumos** do pós-processamento — lixa, tinta, acetona — moram em
  [desgaste de hardware](#user-content-hardware), bloco de acabamento. Aqui
  fica só o tempo; lá fica o material.
- O **rateio e a depreciação** estão em [máquina](#user-content-machine) e
  [custos fixos](#user-content-fixedCost), e são multiplicados pelas horas de
  impressão, não pelas suas horas.
- O lucro por hora exibido em [resultados](#user-content-results) usa
  exatamente esta combinação: horas de impressão + pós + setup diluído.

## Armadilhas práticas

1. **Deixar o valor hora em zero.** É o erro mais frequente. A calculadora
   aceita e simplesmente mostra um preço mais baixo — bonito na tela, prejuízo
   na vida. Se não sabe o número, comece com R$ 25 e ajuste para cima.
2. **Somar o tempo de impressão na mão de obra.** Duplicação pura. A máquina
   já está sendo cobrada por essas horas; a sua pessoa não estava lá o tempo
   todo.
3. **Não contar o setup.** "Ah, foram só 10 minutos." São 10 minutos de cada
   vez que você não faturou. Em cem orçamentos, são mais de 16 horas doadas.
4. **Diluir o pós-processamento em lotes.** O app dilui a mão de obra inteira
   por unidade quando a quantidade é maior que 1, o que é justo para o setup.
   Mas se cada peça é lixada individualmente, o pós é um custo por unidade, não
   do lote — confira se o preço por unidade do
   [resultado](#user-content-results) ainda cobre o acabamento individual.
