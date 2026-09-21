---
title: Custos Adicionais e Vendas
order: 18
---

# Custos Adicionais e Vendas

A seção **sales** é a única da calculadora que **não é um custo**. Todas as
outras somam valores que você já gastou; a `sales` responde a outra pergunta:
dado o custo, **por quanto esta peça deve ser vendida**? É nela que a margem, os
impostos e as taxas de marketplace se encontram — e é por isso que o resultado
delas aparece no preço final, não no custo.

A separação é o ponto central da filosofia da calculadora: **custo é fato, preço
é decisão**. O custo existe independente de você vender; o preço é construído.
Quando a seção `results` coloca os dois lado a lado, a margem deixa de ser um
arredondamento oculto e vira uma alavanca visível.

## Os campos

A seção mistura logística, taxas e lucro:

- **Quantidade** — quantas unidades iguais serão produzidas. O custo de setup é
  diluído entre as unidades e o valor aparece na exportação do orçamento.
- **Preenchimento (infill)** — quanto do interior é preenchido. Auxilia a
  estimar consumo de material: 15% para peças decorativas, 50% ou mais para
  peças funcionais.
- **Peças e extras** — parafusos, colas, verniz, tintas: tudo que entra na peça
  além do plástico.
- **Embalagem** — caixa, plástico bolha, fita.
- **Frete** — o custo da entrega ao cliente.
- **Marketplace** — a plataforma de venda, selecionada do catálogo. Cada uma tem
  a sua taxa percentual, preenchida automaticamente.
- **Taxas e impostos** — impostos sobre o valor da venda (ICMS, ISS, Simples
  Nacional).
- **Margem de lucro** — a porcentagem de lucro desejada sobre o custo total.

## A fórmula do preço de venda

A mecânica é menos óbvia do que parece, e vale a pena entender. Primeiro se
fecha a base: custo de produção mais falhas mais embalagem mais frete. Sobre
essa base aplica-se a margem. E só então entram impostos e taxas — mas de um
jeito especial, **por divisão**, para que eles não comam o seu lucro:

```
custo base       = produção + falhas + embalagem + frete
lucro            = custo base * (margem / 100)
preço s/ taxas   = custo base + lucro
preço de venda   = preço s/ taxas / (1 - (impostos + taxa marketplace) / 100)
```

A divisão não é um detalhe técnico: ela é o que faz a margem ser **honrada**.
Como os impostos são calculados por dentro do preço final, o lucro que sobra no
fim é exatamente a porcentagem que você declarou — nem um centavo a menos.

## Exemplo numérico completo

Uma peça com R$ 20,00 de custo de produção, R$ 2,00 de falha, R$ 2,00 de
embalagem e R$ 1,00 de frete, vendida numa plataforma com 10% de taxa, com 15%
de impostos e margem de 100%:

```
custo base       = 20 + 2 + 2 + 1        = R$ 25,00
lucro (100%)     = 25 * 1,00             = R$ 25,00
preço s/ taxas   = 25 + 25               = R$ 50,00
taxa total       = 15 + 10               = 25%
preço de venda   = 50 / (1 - 0,25)       = R$ 66,67
```

Conferindo o que sobrou:

```
impostos (15%)   = 66,67 * 0,15          = R$ 10,00
marketplace (10%)= 66,67 * 0,10          = R$  6,67
lucro líquido    = 66,67 - 25 - 10 - 6,67 = R$ 25,00
```

O lucro líquido é exatamente os R$ 25,00 da margem. Se os impostos fossem
somados de forma ingênua (R$ 50 + 25% = R$ 62,50), as taxas reais sobre essa
venda seriam de R$ 15,63 — e o lucro cairia para menos de R$ 22,00, abaixo dos
R$ 25,00 declarados. A fórmula divisiva existe para que a margem seja uma
promessa que se cumpre.

## Os presets de markup

Ao lado do campo de margem há botões com porcentagens prontas: 100%, 150%, 200%,
250%, 300% e 500%. São os **presets de markup** — atalhos que preenchem a margem
com um toque, para os casos em que você quer aplicar uma marcação conhecida e
não ficar digitando valores.

Eles são só preenchimento: clicar em 200% é o mesmo que digitar 200 no campo de
margem, e mudar o valor depois cancela o destaque do botão. O que eles
realmente economizam é o raciocínio — em quem vende no atacado, por exemplo,
100% sobre o custo é uma marcação padrão que se repete em todo orçamento.

## Margem consciente vs. arredondamento oculto

A diferença entre precificar bem e precificar mal está na ordem das contas:

- **Margem consciente**: você conhece o custo, decide a margem e o preço é uma
  consequência. Se o mercado reclama, você sabe se o problema é o custo ou a
  margem — e pode mexer em qualquer um dos dois.
- **Arredondamento oculto**: você escolhe o preço que "parece certo" e o lucro é
  o que sobrar. Funciona até o dia em que nada sobra, e você não sabe por quê.

A calculadora foi feita para forçar o primeiro caminho: a seção `results` sempre
mostra custo, lucro e preço de venda juntos, justamente para que a margem nunca
fique escondida atrás do preço final. Quando esse trio aparece na mesma tela, é
impossível fingir que não se sabe de onde vem o dinheiro.

## Armadilhas comuns

Quatro armadilhas moram nesta seção, e cada uma diminui o lucro sem aparecer no preço.

- **Margem baixa demais "para vender mais".** Se a margem não cobre as falhas e
  os custos fixos que você não rateou, vender mais só amplia o prejuízo.
- **Esquecer a taxa de marketplace.** Dez por cento sobre o preço é muito mais
  que dez por cento sobre o custo; deixar o campo zerado é presentear a
  plataforma.
- **Embalagem e frete fora da base.** Eles somam no custo antes da margem —
  colocar R$ 3,00 de frete e não rateá-lo é lucro que some a cada venda.
- **Margem sobre o preço, não sobre o custo.** A margem aqui é markup sobre o
  custo. 100% significa vender pelo dobro do custo — não "lucro de 100% do
  preço", que seria outro número.
