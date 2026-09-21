---
title: Desgaste de Hardware
order: 13
---

# Desgaste de Hardware

A seção **Desgaste de Hardware** existe para responder a uma pergunta que quase
todo iniciante ignora: *o que desta peça se gastou além do filamento?* O
filamento é só a parte visível do consumo. A peça também passa pelo **bico**
(desgastando a abertura), pela **mesa** (gastando adesivo ou a folha PEI) e, na
resina, pela **tela LCD**, pelo **filme FEP** e pela **câmara de cura**.

Esta seção só aparece no nível **avançado** da calculadora. Se você está no
modo rápido ou detalhado, ela fica oculta — mas o custo existe do mesmo jeito,
apenas invisível.

## Por que este custo existe mesmo na peça única

Existe um argumento clássico para ignorar esta seção: *"minha impressora já
está paga, então a peça sai de graça"*. O problema é que o bico não está pago
para sempre. Cada metro de filamento empurrado por um bico de 0,4 mm o alarga
um pouquinho. Um bico de latão novo custa R$ 35 e dura cerca de 20 kg de PLA.
Se a sua peça usa 180 g, ela consumiu 0,9% da vida útil desse bico — é R$ 0,32
que existe na peça única e que ninguém te pagou de volta.

A seção transforma esse desgaste silencioso em um valor que você pode somar e
cobrar. Sem ela, o preço cobre o filamento e doa o desgaste da máquina.

## FDM: bico, mesa e acabamento

No **FDM**, a seção reúne três blocos, cada um com um interruptor próprio.

### Bico (Nozzle)

O bico é rateado pelo peso da peça, e dois campos bastam para fechar a conta.

- **Custo do Bico** — quanto você pagou no bico, em reais. Bico de latão é
  barato; aço endurecido custa várias vezes mais.
- **Vida Útil** — quantos **quilogramas** de filamento esse bico aguenta antes
  de perder a precisão. Latão com PLA: perto de 20 kg. Aço com filamento
  carregado de fibra de carbono: chega a 10 kg ou menos.

Deixar a **Vida Útil** em zero desativa o cálculo do bico (a divisão por zero
é protegida e vira zero — o bico não inflaciona o preço, mas também não é
coberto).

### Mesa e Adesão

Um campo só, fixo por peça, porque o adesivo se gasta a cada impressão e não por hora.

- **Custo Adesivo/Print** — valor estimado de spray, cola, fita ou desgaste da
  folha PEI **por impressão**. É um valor fixo por peça, não por hora.

### Acabamento Físico

Um campo para o que você gastou em lixa, primer e tinta nesta peça específica.

- **Insumos Acabamento** — o que você gasta em lixa, primer, tinta, massa
  plástica ou acetona nesta peça especificamente. Se a peça é entregue sem
  nenhum acabamento, deixe em zero.

## Resina: LCD, FEP, lavagem e cura

Na aba de resina a mesma seção ganha outros desgastes, porque uma impressora
SLA tem partes que se gastam por **hora** e por **peça**.

- **Custo Tela LCD** e **Vida Útil LCD** — a tela da resina perde potência com
  o uso. A vida útil é contada em **horas** de exposição.
- **Custo Filme FEP** e **Durabilidade FEP** — o filme do fundo do tanque é
  riscado a cada peça descolada. A durabilidade é contada em **impressões**.
- **Lavagem (Álcool)** — custo do litro de isopropílico e volume consumido por
  ciclo. Resina **lavável em água** zera este bloco automaticamente, porque a
  peça é limpa sob a torneira.
- **Cura UV** — tempo de cura e potência da lâmpada, que também se gasta.

## A fórmula

Para o FDM, a conta é direta: o bico é rateado pelo peso da peça, a mesa e o
acabamento são fixos por peça.

```
pesoKg = pesoDaPeca / 1000

desgasteBico = (pesoKg / vidaUtilKg) * custoBico
desgasteMesa = custoAdesivo
acabamento   = insumosAcabamento

hardware = desgasteBico + desgasteMesa + acabamento
```

Na resina, LCD é rateado por hora e FEP por impressão:

```
desgasteLCD = (tempoExposicaoH / vidaUtilLCDH) * custoLCD
desgasteFEP = (1 / durabilidadeFEP) * custoFEP
```

## Exemplo numérico passo a passo

Imagine um **suporte de celular** em PLA, com **180 g** de filamento, saindo
com lixamento leve e pintura.

Passo a passo pelo FDM:

```
pesoKg = 180 / 1000 = 0,18 kg

desgasteBico = (0,18 / 20) * 35 = 0,009 * 35 = R$ 0,32
desgasteMesa = R$ 1,50
acabamento   = R$ 2,00

hardware = 0,32 + 1,50 + 2,00 = R$ 3,82
```

A peça acabou de ficar **R$ 3,82** mais cara do que o "só o filamento". São
R$ 0,32 de bico que ninguém lembra de cobrar — em cem peças iguais, são
R$ 32 só de bico, o suficiente para um bico novo e mais um café.

## Como esta seção se relaciona com as demais

A seção se conecta com cinco outras, e cada fronteira evita uma duplicação de custo.

- O **peso** que entra na fórmula do bico vem da seção de
  [material](#user-content-material) — preencha-a primeiro.
- O **tempo de exposição** do LCD vem do tempo de impressão, na seção de
  [parâmetros](#user-content-parâmetros-de-impressão).
- A depreciação da impressora **inteira** (o bem, não as partes) mora na seção
  [máquina](#user-content-custos-da-máquina). Hardware é a parte que se gasta; máquina é
  o todo que se deprecia.
- O **tempo** que você gasta lixando e pintando é cobrado à parte, em
  [mão de obra](#user-content-mão-de-obra) — aqui ficam só os insumos.
- O resultado de tudo isto é somado em [resultados](#user-content-resultados).

## Armadilhas práticas

Quatro erros no preenchimento, e todos eles deixam o desgaste de fora do preço.

1. **Subestimar a vida útil do bico com filamento abrasivo.** Fibra de carbono
   e glitter comem bico de latão em poucos quilos. Se você imprime com esses
   materiais, ou a vida útil baixa para 10 kg ou o bico sobe para aço.
2. **Esquecer o acabamento.** É o campo mais deixado em zero — e o que mais
   difere uma peça "de protótipo" de uma peça "de produto". Lixa e tinta não
   são de graça.
3. **Confundir desgaste com depreciação.** Se você colocar o preço da impressora
   aqui, o custo sai duplicado: a impressora inteira já está sendo depreciada na
   seção [máquina](#user-content-custos-da-máquina). Aqui entram só as partes
   consumíveis.
4. **Medir a vida útil do bico em peças, não em quilos.** O bico se desgasta
   pela quantidade de material extrudado, não pela quantidade de arquivos. Uma
   peça oca de 800 g gasta oito vezes mais bico que um charuto de 100 g.
