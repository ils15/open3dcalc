---
title: Inventário
order: 20
tourId: inventario-bobinas
---

# Inventário

O **Inventário** é o catálogo que alimenta a calculadora. Em vez de estimar o
custo com valores genéricos, você cadastra uma vez o que comprou e o que usa —
e toda estimativa passa a sair de números reais.

Ele está espalhado em duas abas, lado a lado no app:

- **Filamentos**: os rolos de filamento que você tem na prateleira.
- **Cadastros**: impressoras, materiais e marketplaces usados como presets.

Cada campo dessas abas é lido por uma seção específica da calculadora. Se um
deles estiver errado, todo orçamento que o usa sai errado — por isso este
catálogo é o lugar mais barato de ganhar precisão.

## A aba Filamentos

Cada entrada é um **rolo** físico, com os campos:

- **Marca** e **material** (PLA, PETG, ABS, TPU, ASA, SILK...).
- **Cor** e a cor em hexa, para diferenciar rolos parecidos.
- **Peso restante** e **peso original**, em gramas.
- **Preço por kg**, que é quanto você pagou por quilo.
- **Diâmetro**, em milímetros — o padrão é `1.75`.
- **Status**: `Em estoque`, `A caminho` ou `Vazio`.
- **Tara do carretel**, o peso da bobina vazia.
- **Onde comprou** e **observações**, livres.

A lista filtra por material e por status, então você acha rápido o rolo certo
antes de começar uma impressão.

## A aba Cadastros

São três catálogos de presets:

- **Impressoras**: nome, marca, **potência** (W), **valor** (R$), **vida útil**
  em horas, **manutenção por hora** (R$/h) e tags livres de organização.
- **Materiais**: nome, **tipo** (`fdm` ou `resina`), **densidade** (g/cm³) e
  **preço médio** (R$/kg).
- **Marketplaces**: nome, **taxa percentual**, **taxa fixa**, **frete grátis**
  e a **porcentagem do frete**.

O app já traz uma lista pronta de materiais (PLA, PETG, ABS, ASA, TPU, Nylon,
PC e as versões com fibra de carbono) e de impressoras conhecidas. Você edita
qualquer preset ou cria um personalizado.

## Como cada campo chega à estimativa

A calculadora divide o custo em seções independentes, e o inventário alimenta
quatro delas:

- preço por kg, peso restante e diâmetro do rolo → seção [Material](#user-content-material)
- valor da impressora, vida útil e manutenção mensal → seção [Machine](#user-content-custos-da-máquina)
- potência da impressora e tarifa de energia → seção [Print](#user-content-parâmetros-de-impressão)
- taxas e frete do marketplace → seção [Sales](#user-content-custos-adicionais-e-vendas)

```
material = (peso da peca + peso das falhas) * preco por kg / 1000
machine  = ((valor da impressora / vida util) + (manutencao mensal / horas por mes) + rateio fixo) * horas
print    = (potencia / 1000) * horas * tarifa de energia
```

O diâmetro entra antes de tudo: ele converte o volume do modelo em peso. Por
isso o padrão é `1.75` — um desvio de `0.05` mm já muda o volume em cerca de
`5.7%`, e o peso junto.

## Estimativa genérica x catálogo real

Imagine uma peça de **180 g**. Com o preset genérico de PLA a R$ 90/kg:

```
material = 0.180 kg * R$ 90 = R$ 16,20
```

Você pagou R$ 112/kg num PLA Silk específico. Com o catálogo atualizado:

```
material = 0.180 kg * R$ 112 = R$ 20,16
```

São **R$ 3,96 a mais** por peça — 24% acima do que a estimativa genérica
mostrava. Num mês de 50 peças, R$ 198 de margem que sumiria sem ninguém
perceber. O catálogo não muda o preço que você paga; ele só mostra a verdade.

O mesmo vale para a máquina. Uma impressora de R$ 1.800 com vida útil de
2.000 horas custa **R$ 0,90 por hora** de uso, então uma impressão de 6 horas
embute R$ 5,40 de amortização — esse valor entra na seção Machine. A potência
cadastrada alimenta outra seção, a Print: 350 W durante 6 horas, a R$ 0,75 o
kWh, somam R$ 1,58 de energia. Sem esses campos cadastrados, a
calculadora não tem como adivinhar nenhum dos dois.

## Rolo parcial, tara e cobertura

O **peso restante** é o que torna o inventário útil no dia a dia. Ele anda
junto com a calculadora: a peça ativa e a quantidade atual definem quanto
plástico a impressão vai consumir, e cada rolo responde se dá conta:

```
necessario = peso unitario da peca * quantidade
cobertura  = peso restante do rolo - necessario
```

Quando falta, o app mostra **"Não cobre a peça"** e quantos gramas faltam.
Assim você troca o rolo antes de imprimir, e não no meio do print.

Para pesar um rolo parcial na balança, informe a **tara**. Sem ela, a leitura
inclui o carretel vazio. O app conhece as taras por marca (Bambu Lab 210 g,
Prusament 194 g, Polymaker 140 g, Anycubic 127 g) e usa a tabela
automaticamente — mas uma tara medida no rolo sempre vence a tabela, porque
variação de lote existe.

Exemplo: a balança mostra 400 g num rolo Bambu Lab. Descontando a tara de
210 g, restam **190 g** de filamento de verdade. Ignorar a tara faria a
calculadora superestimar o material em mais de 100%.

## Armadilhas que custam dinheiro

Quatro erros de cadastro silenciosos, cada um suficiente para tirar a precisão de todas as estimativas.

- **Densidade errada**: ABS é 1,04 g/cm³, PLA é 1,24. Uma peça de 100 cm³ são
  104 g de ABS ou 124 g de PLA — 20 g de diferença. Quem estima por volume
  com a densidade de outro material erra o peso, e o custo vai junto.
- **Preço por rolo, não por kg**: um rolo de 1 kg a R$ 90 é R$ 90/kg; um
  "econômico" de 500 g a R$ 65 é R$ 130/kg — 44% mais caro por grama.
- **Rolo parcial não contabilizado**: orçar com o peso original de um rolo
  pela metade faz a cobertura falhar na hora de imprimir.
- **Status esquecido**: um rolo marcado como `Em estoque` mas vazio engana o
  filtro na hora de escolher o filamento.

## Por que vale a pena

Cadastrar é trabalho de uma vez. Cada campo preenchido é uma estimativa mais
precisa para sempre, sem comprar nada e sem mudar o processo. Não existe
outra alavanca no app que entregue tanto ganho de precisão por tão pouco
esforço — comece pela impressora e pelo material que você mais usa, e o
resto fica mais fácil.
