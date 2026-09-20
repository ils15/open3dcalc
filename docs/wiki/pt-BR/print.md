---
title: Parâmetros de Impressão
order: 11
---

# Parâmetros de Impressão

A seção **print** mede o que a impressora consome enquanto a peça é feita: tempo
de máquina e energia elétrica. É a seção mais direta da calculadora — poucos
campos, sem ajustes subjetivos — mas é também onde muita gente confunde duas
contas diferentes.

A regra de ouro: **print mede o consumo, machine mede o investimento**. A
seção `print` responde "quanto tempo e quanta energia esta peça exigiu?"; a
seção [machine](#user-content-machine) responde "quanto do preço da impressora
este tempo vale?". Uma não substitui a outra: a energia é uma conta de luz, e a
depreciação é uma conta de equipamento. As duas entram no custo, separadas.

## Os três campos básicos

- **Tempo de impressão** — o total que a máquina leva, conforme o fatiador. Não
  inclui o tempo de pós-processamento (que fica na seção `labor`).
- **Potência da impressora** — o consumo médio em watts. A maioria das FDM fica
  entre 100 W e 350 W; resinas costumam consumir menos, mas têm a cura como
  etapa extra.
- **Custo da energia** — o valor do kWh da sua conta de luz.

O cálculo é uma multiplicação simples: potência vira quilowatts, vezes o tempo,
vezes o preço do kWh.

```
energia (kWh)      = (potência / 1000) * horas
custo da energia   = energia (kWh) * custo por kWh
```

## Exemplo numérico

Uma peça que leva 5 horas numa impressora de 250 W, com energia a R$ 0,80 o
kWh:

```
energia    = (250 / 1000) * 5 = 1,25 kWh
custo      = 1,25 * 0,80      = R$ 1,00
```

Cinco horas de máquina por R$ 1,00. É por isso que a energia raramente é o
problema de um orçamento — mas também é por isso que ela é a primeira conta que
a gente esquece. Em cem peças, são R$ 100 que ninguém colocou no preço.

Se a potência ou o tempo mudar, o custo acompanha na mesma proporção: uma peça
de 10 horas na mesma máquina custa R$ 2,00 de energia; uma máquina de 500 W
faria a mesma peça em 5 horas custar R$ 2,00 também.

## Seleção de impressora

No nível **Detalhado** (e apenas na aba FDM), a seção ganha um seletor de
impressora. Ele lista as impressoras cadastradas no catálogo — cada uma com
marca, potência e valor — e, ao escolher uma, **o campo de potência é
preenchido automaticamente** com os dados daquela máquina.

A utilidade não é economizar digitação: é **consistência**. Se você sabe que a
Ender 3 da oficina puxa 250 W médios, basta cadastrá-la uma vez para que toda
estimativa use esse número, em vez de um valor qualquer lembrado no momento.
Quando a impressora certa está selecionada, o campo de potência passa a refletir
a realidade — e os orçamentos ficam comparáveis entre si.

## O ajuste de aquecimento

No nível **Completo** aparecem dois campos que refinam o cálculo de energia:
o tempo de aquecimento e o percentual de potência extra durante ele. A máquina
consome mais no aquecimento do que no resto do print, e esses campos somam esse
excesso à conta.

Para a maioria dos orçamentos a diferença é de centavos — alguns minutos de
pico de potência numa impressora de 250 W. Ele existe para quem quer a conta de
energia exata, mas não muda a estrutura do cálculo: continua sendo kWh vezes
preço do kWh.

## A fronteira com a seção machine

A separação entre `print` e `machine` é intencional e vale a pena entender:

- **`print`** é **variável por peça** — depende do tempo e da potência que esta
  peça específica exigiu. Peça maior, mais horas, mais energia.
- **`machine`** é **fixa por hora** — pega o preço da impressora, divide pelas
  horas totais de vida útil e dá um custo por hora. As horas que a peça usa
  multiplicam esse valor.

Por isso uma peça de 5 horas tem sempre o mesmo custo de energia (se a potência
for a mesma), mas um custo de máquina que **depende de quantas horas a
impressora já trabalhou no mês**. Quando você liga a seção machine, a hora deixa
de ser de graça — e peças longas passam a custar proporcionalmente mais que o
dobro do tempo de máquina.

## Armadilhas comuns

- **Usar a potência de pico.** Uma impressora de 350 W de pico trabalha a 150 W
  na maioria do tempo. O campo pede a média; usar o pico infla a energia toda.
- **Confundir tempo de máquina com tempo total.** O fatiador dá o tempo de
  impressão; retirar da placa, lavar, curar e finalizar ficam na seção `labor`.
- **Esquecer de atualizar a conta de luz.** O kWh sobe; se o campo continua com
  o valor antigo, todas as estimativas ficam levemente abaixo da realidade.
