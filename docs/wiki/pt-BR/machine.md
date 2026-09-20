---
title: Custos da Máquina
order: 14
---

# Custos da Máquina

A seção **Custos da Máquina** responde a: *quanto desta peça é o desgaste da
impressora?* É a depreciação do equipamento: o preço que você pagou pela
impressora, dividido pela vida útil dela, cobrado por hora de trabalho. É a
seção que faz o preço de uma peça incluir, fatia por fatia, o dinheiro que você
gastou para comprar a máquina.

Esta seção só aparece no nível **avançado**. No modo rápido ou detalhado ela é
omitida — a depreciação fica embutida mas não é mostrada.

## Máquina, energia e hardware: três coisas diferentes

Estas três seções se confundem facilmente. A distinção é esta:

- **Parâmetros de impressão** mede a **energia** — quantos kWh a impressora
  consumiu nesta peça. É conta de luz.
- **Máquina** mede a **depreciação da impressora inteira** — o bem se pagando
  ao longo da vida útil.
- **Desgaste de hardware** mede as **partes consumíveis** — bico, mesa, LCD,
  FEP. Veja [hardware](#user-content-desgaste-de-hardware).

Se você colocar o preço da impressora em dois desses três lugares, o cliente
paga a máquina duas vezes.

## Campos da seção

Cada campo aqui é uma peça da taxa horária. O interruptor no topo da seção
liga ou desliga a depreciação inteira.

- **Custo da Impressora** — quanto você pagou pela máquina, em reais. Inclua
  frete e impostos se possível, porque é o que saiu do seu bolso. Deixar em
  zero desativa a depreciação (a máquina "de graça", o que raramente é
  verdade).
- **Depreciação** — em **quantos meses** a impressora se paga. O padrão do
  mercado é 36 meses para equipamentos. Um prazo curto (12 meses) gera uma taxa
  horária alta; um prazo longo (60 meses) barateia cada peça, mas a máquina
  provavelmente vai morrer antes de terminar.
- **Uso Mensal** — **quantas horas por mês** a impressora fica de fato
  imprimindo. É o campo mais perigoso da seção, e tem uma armadilha abaixo.
- **Manutenção** (interruptor) — ativa o bloco de manutenção.
- **Custo Mensal Manutenção** — quanto você gasta por mês em bicos de
  reposição, correias, rolamentos, lubrificação e peças sobressalentes.

## A fórmula

A vida útil total é a multiplicação dos meses pelas horas mensais. A taxa
horária é o preço dividido por essa vida.

```
vidaUtilHoras = depreciacaoMeses * horasPorMes

depreciacaoPorHora = custoImpressora / vidaUtilHoras
manutencaoPorHora  = custoManutencao / horasPorMes

taxaHoraria = depreciacaoPorHora + manutencaoPorHora + rateioFixo

machine = taxaHoraria * tempoImpressaoHoras
```

O `rateioFixo` vem da seção [custos fixos](#user-content-custos-fixos) e é
adicionado aqui, na taxa horária da máquina, porque é na máquina que as horas
produtivas acontecem. Se os custos fixos estão desligados, essa parcela é
zero.

O cálculo é protegido contra divisão por zero: `vidaUtilHoras` ou
`horasPorMes` iguais a zero zeram a parcela correspondente em vez de estourar.

## Exemplo numérico passo a passo

Uma **Ender 3** custou **R$ 1.800**. Você usa há 3 anos, imprime cerca de
**100 horas por mês** e gasta **R$ 30 por mês** com manutenção. Vamos montar a
peça-exemplo: um suporte de celular com **5,5 horas** de impressão.

```
vidaUtilHoras = 36 * 100 = 3.600 h

depreciacaoPorHora = 1.800 / 3.600 = R$ 0,50/h
manutencaoPorHora  = 30 / 100      = R$ 0,30/h
rateioFixo          = R$ 3,00/h   (de custos fixos)

taxaHoraria = 0,50 + 0,30 + 3,00 = R$ 3,80/h

machine = 3,80 * 5,5 = R$ 20,90
```

A peça carrega **R$ 20,90** de máquina. Desse total, R$ 2,75 são de depreciação
pura (0,50 × 5,5), R$ 1,65 são de manutenção e R$ 16,50 são de rateio de custos
fixos. Note quem domina: o rateio fixo. É por isso que a seção
[custos fixos](#user-content-custos-fixos) é a que mais separa hobby de negócio.

Uma observação sobre os números. Este exemplo usa **100 horas por mês**, que é o
uso real **desta impressora**. É a base da depreciação e da manutenção. A seção de
[custos fixos](#user-content-custos-fixos) trabalha com **150 horas por mês**, que
são as horas produtivas da oficina inteira. Esses campos são independentes no
aplicativo, e os valores diferentes estão corretos: um mede o desgaste de uma
máquina, o outro rateia o custo do espaço.

## Sensibilidade: o que muda a taxa

A taxa horária é uma fração com dois denominadores. Pequenas mudanças nos
campos têm efeito grande no preço final:

```
Uso mensal de 200 h em vez de 100 h:
  depreciacaoPorHora = 1.800 / 7.200 = R$ 0,25/h   (metade!)

Depreciação de 12 meses em vez de 36:
  depreciacaoPorHora = 1.800 / 1.200 = R$ 1,50/h   (tríplice!)
```

Se você imprime pouco, a depreciação por peça é alta — e isso é correto, não
erro da calculadora. O remédio não é mentir as horas, é imprimir mais ou aceitar
que peças avulsas em uma máquina parada são caras de verdade.

## Como esta seção se relaciona com as demais

- O **tempo** que multiplica a taxa horária é o tempo de impressão da seção de
  [parâmetros](#user-content-parâmetros-de-impressão), não o tempo de mão de obra.
- O **rateio** que entra na taxa vem de
  [custos fixos](#user-content-custos-fixos).
- As **partes** gastas (bico, mesa) estão em [hardware](#user-content-desgaste-de-hardware)
  e são somadas à parte.
- A depreciação entra no bloco "Equipamento & Desgaste" do
  [resultado](#user-content-resultados).

## Armadilhas práticas

1. **Superestimar o uso mensal.** É a armadilha número um. Se você coloca 200
   h/mês mas a impressora só roda 40 h, a depreciação fica cinco vezes mais
   baixa que a real e toda peça sai subprecificada. Coloque a média honesta dos
   últimos três meses.
2. **Esquecer a manutenção.** Impressora 3D é um aparelho com peças móveis
   sobrescendo. Se você não liga a manutenção, em oito meses chega a conta real
   de correias e bicos que nenhuma peça pagou.
3. **Depreciação longa demais.** 60 meses faz a taxa horária parecer
   irresistível, mas uma Ender 3 dificilmente sobrevive 3.600 horas úteis sem
   a precisão degradar. 24 a 36 meses é o intervalo realista.
4. **Contar horas de impressora ligada como horas imprimindo.** Aquecimento,
  nivelamento e troca de filamento não imprimem nada. O campo é "horas por mês
  imprimindo" — o tempo de chapa de fato se movendo.
