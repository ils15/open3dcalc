---
title: Resultados
order: 19
---

# Resultados

A seção **Resultados** é onde tudo se encontra: pega cada custo das outras seções,
soma na ordem certa e responde às três perguntas que importam — **quanto a peça
custou**, **por quanto deve ser vendida** e **quanto sobra de lucro**.

Diferente das outras seções avançadas, os resultados aparecem em **todos os
níveis**. O que muda é o detalhe das parcelas; a consolidação final está sempre
lá.

## A ordem da soma importa

O preço de venda não é "custo mais um acréscimo". É uma sequência em que cada
etapa adiciona algo diferente:

```
custoProducao = material + energia + maquina + hardware
              + epi + maoDeObra + software + acabamento + extras

custoBase = custoProducao + falhas + embalagem + frete

lucroBruto = custoBase * (margem / 100)

precoAntesTaxas = custoBase + lucroBruto

precoVenda = precoAntesTaxas / (1 - (impostos% + taxas%) / 100)
```

Repare em duas coisas. Primeiro, a **falha** e a **logística** (embalagem e
frete) entram no custo base — você lucra sobre elas também. Segundo, os
impostos e a taxa de marketplace são descontados **do preço de venda**, então
eles aumentam o preço final, não diminuem o seu lucro.

## Marcas importantes do resultado

- **Custo Total** — quanto a peça custou para existir, incluindo falha,
  embalagem e frete. É o **ponto de equilíbrio**: vender abaixo é prejuízo, e o
  app avisa.
- **Preço de Venda** — o sugerido pela fórmula. Editável; a margem real é
  recalculada na hora.
- **Margem Real** — o lucro líquido sobre o preço de venda, não sobre o custo. É
  sempre menor que a margem digitada — veja o exemplo.
- **Lucro por Hora** — lucro líquido ÷ horas totais (impressão + pós + setup).
  É a melhor métrica para decidir se um trabalho vale a pena.

## Exemplo numérico completo

Vamos consolidar a peça-exemplo usada em todos os artigos: um **suporte de
celular em PLA**, 180 g, 5,5 horas de impressão, 150 W de potência, impressora
de R$ 1.800 depreciada em 36 meses a 100 h/mês, R$ 30/mês de manutenção, R$ 550
de custos fixos a 150 h/mês, 30 minutos de mão de obra a R$ 25/h, slicer de
R$ 30/mês, STL de R$ 5, EPI de R$ 2 por peça, 10% de falha, embalagem R$ 3,
frete R$ 8, margem de 50%, 6% de impostos e 10% de marketplace.

Cada parcela, vinda de sua seção:

```
material    0,18 kg * R$ 90/kg   =  R$ 16,20
energia     0,825 kWh * R$ 0,75  =  R$  0,62
maquina     R$ 3,80/h * 5,5 h    =  R$ 20,90
hardware    bico + mesa + pintura=  R$  3,82
maoDeObra   0,5 h * R$ 25        =  R$ 12,50
ops         software + EPI       =  R$  8,65
```

Agora a consolidação:

```
custoProducao = 16,20 + 0,62 + 20,90 + 3,82 + 12,50 + 8,65 = R$ 62,69

falha (10%)   = 62,69 * 0,10                              =  R$  6,27
embalagem                                                        R$  3,00
frete                                                            R$  8,00
custoBase     = 62,69 + 6,27 + 3,00 + 8,00                 = R$ 79,96

lucroBruto    = 79,96 * 0,50                              = R$ 39,98
precoAntesTaxas = 79,96 + 39,98                           = R$ 119,94

precoVenda    = 119,94 / (1 - 0,16)                       = R$ 142,79

imposto (6%)  = 142,79 * 0,06                             =  R$  8,57
marketplace   = 142,79 * 0,10                             =  R$ 14,28

lucroLiquido  = 142,79 - 79,96 - 8,57 - 14,28            = R$ 39,98
margemReal    = 39,98 / 142,79                           =   28,0%
```

## A lição escondida no exemplo

Você pediu **50% de margem** e acabou com **28% de margem real**. Nada foi
calculado errado: os 50% são uma margem **sobre o custo** (markup), enquanto a
margem real é sobre o **preço de venda** — que é maior, porque impostos e taxas
o incharam.

A boa notícia está no lucro: **R$ 39,98**, exatamente os 50% do custo base. Não
é coincidência: a fórmula repassa impostos e taxas para o preço, então o lucro
líquido é preservado. O que muda é a porcentagem, não o dinheiro.

O **lucro por hora** aqui é:

```
horasTotais = (330 + 18 + 12) / 60 = 6,0 h
lucroPorHora = 39,98 / 6,0 = R$ 6,66/h
```

R$ 6,66 por hora é o número que decide se este trabalho vale a pena — muito
mais honesto que "50% de margem".

## Modo margem alvo e preço personalizado

Nem sempre você quer derivar o preço. Às vezes o cliente diz "quero pagar R$
120" e você precisa saber se vale a pena. Para isso serve o **modo margem
alvo**: você digita o preço de venda desejado e a calculadora mostra a margem
real dele, descontando impostos e taxas do valor digitado.

Na nossa peça, um preço de R$ 120 daria:

```
imposto = 7,20    marketplace = 12,00
lucro = 120 - 79,96 - 7,20 - 12,00 = R$ 20,84
margemReal = 20,84 / 120 = 17,4%
```

Se o resultado ficar abaixo do ponto de equilíbrio, a calculadora avisa na tela
— é o sinal de que é melhor recusar o trabalho do que aceitar prejuízo.

## Projeção mensal e lotes

A seção ainda mostra uma **projeção mensal**: quantas peças você vende por mês e
o que isso dá em receita, custo e lucro. Na nossa peça, a 30 vendas por mês:

```
receita = 142,79 * 30 = R$ 4.283,70
custo   =  79,96 * 30 = R$ 2.398,80
lucro   =  39,98 * 30 = R$ 1.199,40   (anual: R$ 14.392,80)
```

Para mais de uma unidade, o **setup** é diluído entre as peças — veja
[mão de obra](#user-content-mão-de-obra). O preço por unidade cai e a diferença
aparece aqui.

## Como esta seção se relaciona com as demais

Cada parcela do resultado vem de um lugar específico:

- [material](#user-content-material) — o filamento consumido.
- [parâmetros](#user-content-parâmetros-de-impressão) — tempo, energia e a impressora usada.
- [máquina](#user-content-custos-da-máquina) — depreciação, manutenção e rateio de
  [custos fixos](#user-content-custos-fixos).
- [hardware](#user-content-desgaste-de-hardware) — desgaste de bico, mesa, LCD e
  acabamento.
- [mão de obra](#user-content-mão-de-obra) — setup e pós-processamento.
- [ops](#user-content-operacional--software) — software, STL e EPI.
- [falhas e vendas](#user-content-custos-adicionais-e-vendas) — risco, embalagem, frete, impostos e
  margem.

## Armadilhas práticas

1. **Achar que 50% de margem é 50% de lucro no preço.** Como o exemplo mostra,
   é 28%. Sempre leia a **margem real**, não a margem que você digitou.
2. **Vender pelo ponto de equilíbrio.** O custo total é o piso de
   sobrevivência, não o preço justo. Vender nele significa trabalhar de graça e
   ainda pagar imposto.
3. **Esquecer que a falha lucra junto.** A falha entra no custo base e recebe
   margem. É correto — uma peça que falhar sai mais cara que uma que não falha,
   e as peças que dão certo precisam pagar as que falham.
4. **Desconsiderar o lucro por hora.** Um trabalho de R$ 200 de lucro em 80
   horas de máquina rende R$ 2,50/h. O lucro em reais parece bom; o por hora
   revela que era melhor ter feito outra coisa.
