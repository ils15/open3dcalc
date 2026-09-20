---
title: Material
order: 10
---

# Material

A seção **material** calcula quanto de filamento ou resina a peça consome e
converte isso em dinheiro. É a primeira seção da calculadora e, na maioria das
impressões, a que mais pesa no custo final — por isso é também a primeira onde
um erro de contexto vira erro de preço.

A ideia central é separar duas coisas: **o que a peça pesa** e **o que você
realmente pagou pelo material**. Uma peça de 50 g feita com um carretel de
R$ 125/kg não custa R$ 6,25 — porque o rolo nunca é usado inteiro, a purga
desperdiça plástico e a resina fica no tanque. A seção material junta essas
perdas no cálculo, em vez de fingir que não existem.

## FDM: peso, preço e eficiência

Na impressação por filamento, os campos básicos são:

- **Tipo de material** — PLA, PETG, ABS e outros. Define a densidade usada nas
  conversões de volume e as sugestões de preço.
- **Custo por kg** — o preço médio do quilo. Como referência: PLA fica em torno
  de R$ 90, PETG R$ 110 e ABS R$ 100.
- **Peso usado** — quantos gramas a peça consome, segundo o fatiador.

A fórmula básica é direta: peso convertido em quilos vezes o preço do quilo.

```
custo do material = (peso usado / 1000) * custo por kg
```

Uma peça de 50 g com PLA a R$ 125/kg custa `(50/1000) * 125 = R$ 6,25`. Esse é o
custo **teórico**, sem perdas — e raramente é o custo real.

## Os campos que ninguém lembra

Ao subir para o nível **Detalhado**, a seção material revela quatro campos que
corrigem a diferença entre a teoria e a impressão real:

- **Purga / perda** — os gramas desperdiçados na torre de purga ou na troca de
  cor. Em prints multicoloridos pode ser maior que a própria peça.
- **Eficiência do carretel** — ninguém usa 100% do rolo: sobras finais e trocas
  reduzem o aproveitamento. O padrão sugerido é 95–98%.
- **Densidade** — usada para converter volume em peso. PLA ≈ 1,24, PETG ≈ 1,27,
  ABS ≈ 1,04 g/cm³.
- **Margem de perda** — aplicada na resina, cobre o que fica no tanque, nos
  suportes e na limpeza. Sugerido: 5–10%.

Purga e eficiência mudam o custo de forma diferente. A **purga** é um peso extra
que some no lixo; a **eficiência** é um fator que dilui o preço do quilo em tudo
que você consome. A fórmula completa aplica os dois:

```
peso total     = peso usado + purga
peso efetivo   = peso total * (100 / eficiência do rolo)
custo material = (peso efetivo / 1000) * custo por kg
```

Note a divisão: se a eficiência é 98%, o fator é `100/98 ≈ 1,02` — você paga
cerca de 2% a mais no custo de cada grama, porque parte do rolo foi para o
lixo. É pouco por peça, e muito por ano.

## Exemplo numérico completo

Uma peça em PLA de 50 g, com torre de purga de 8 g, eficiência de 98% e
R$ 125/kg:

```
peso total     = 50 + 8            = 58 g
fator          = 100 / 98          = 1,0204
peso efetivo   = 58 * 1,0204       = 59,18 g
custo material = 0,05918 * 125     = R$ 7,40
```

Sem esses campos o cálculo diria R$ 6,25. A diferença, R$ 1,15 por peça, é
exatamente o tipo de perda que aparece quando se faz cem unidades — R$ 115 de
lucro evaporado por esquecer a purga.

## Resina: volume, não peso

Na impressão por resina a lógica é outra, porque você compra líquido. Os campos
mudam:

- **Custo por litro** — o preço da resina na garrafa.
- **Volume usado** — quantos mililitros a peça consome.
- **Margem de perda** — o percentual que fica no tanque e nos suportes.
- **Densidade** — converte o volume em peso, para o registro no inventário.

A fórmula é análoga à do filamento, mas no universo dos mililitros:

```
volume com perda = volume usado * (1 + margem de perda / 100)
custo do material = (volume com perda / 1000) * custo por litro
```

Uma peça de 30 ml, com 10% de margem de perda e resina a R$ 150 o litro:

```
volume com perda = 30 * 1,10      = 33 ml
custo material   = 0,033 * 150    = R$ 4,95
```

A densidade não entra no preço — ela só existe para que o inventário saiba
quantos gramas a peça tem, informação usada no controle de estoque de resina.

## Como o inventário alimenta a seção

Você não precisa digitar custo e densidade toda vez. Se o filamento está
catalogado no **inventário**, a calculadora oferece a lista de carretéis
cadastrados e, ao selecionar um, os valores da seção são preenchidos com os
dados daquele rolo: tipo de material, custo por kg e densidade.

A ligação também funciona no sentido contrário: quando uma peça usa um carretel
selecionado, o sistema mostra quanto daquele rolo ainda resta — e desconta o
peso consumido a cada impressão. Assim o preço da próxima peça é calculado com o
custo real do plástico que você tem na prateleira, e não com uma estimativa
fixa. Veja detalhes no artigo sobre o [inventário](#user-content-inventario).

## Armadilhas comuns

- **Esquecer a purga em prints coloridos.** A torre de purga de um modelo com
  três cores pode pesar mais que a peça. Sem o campo, o custo fica subestimado
  desde a primeira peça.
- **Usar densidade errada.** PLA e ABS têm densidades bem diferentes; se o
  catálogo diz 1,24 e o rolo é 1,04, toda conversão de volume sai errada.
- **Misturar custo do rolo com custo do quilo.** Um carretel de R$ 90 com 1 kg
  é R$ 90/kg; um de R$ 90 com 750 g é R$ 120/kg. O inventário guarda o preço
  por quilo justamente para essa armadilha não existir.
- **Manter a eficiência em 100%.** É tentador, mas é mentira: o último trecho
  do rolo é quase sempre desperdiçado. 98% é um valor honesto.
