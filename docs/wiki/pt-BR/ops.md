---
title: Operacional & Software
order: 17
---

# Operacional & Software

A seção **Operacional & Software** responde a: *que custos invisíveis esta peça
carrega?* É onde moram as assinaturas de software, o modelo 3D que você
comprou, as luvas e o álcool — coisas que não são filamento nem máquina, e que
quase sempre ficam de fora do orçamento.

Esta seção só aparece no nível **avançado**. Ela tem dois blocos: **Software e
Arquivos** e **EPIs / Consumíveis**.

## Por que "invisível" é a palavra certa

Você não vê o slicer na peça. Não vê a luva. Não vê o arquivo STL pago. Mas
cada um deles é uma despesa real que existiu para que esta peça existisse. O
exemplo clássico é o slicer: uma assinatura de R$ 30 por mês parece pouco, mas
se você imprime 100 horas por mês, cada hora carrega R$ 0,30 — e em uma peça de
5,5 horas são R$ 1,65 que ninguém costuma cobrar.

A mesma lógica vale para o modelo. Se você pagou R$ 50 por um arquivo STL e
vende 10 peças dele, cada peça carrega R$ 5 de arquivo. Se você vende 1.000,
carrega R$ 0,05. O custo existe; o que muda é a diluição.

## Bloco: Software e Arquivos

- **Mensalidade Slicer** — o custo mensal do software de fatiamento, se você
  usa um pago. Deixe em zero se usa um slicer gratuito; mas lembre que a versão
  "gratuita" de muitos slicers não é a comercial.
- **Custo do Arquivo STL** — quanto você pagou pelo arquivo 3D, se comprou de
  terceiros. É cobrado **uma vez por peça**, não por hora, então peça única
  carrega o valor inteiro.

A mensalidade é rateada pelas horas de impressão do mês, usando o **mesmo
campo de horas** da seção [máquina](#user-content-custos-da-máquina):

```
softwarePorHora = mensalidadeSlicer / horasPorMes

software = (softwarePorHora * tempoImpressaoHoras) + custoArquivoSTL
```

O custo do arquivo é somado inteiro, porque cada peça sai dele. Atenção aqui:
quando a quantidade é maior que 1, só a **mão de obra** é diluída entre as
unidades — o arquivo STL continua cobrado por inteiro em cada peça. Veja
[mão de obra](#user-content-mão-de-obra) e [resultados](#user-content-resultados).

## Bloco: EPIs / Consumíveis

- **Custo EPI por Print** — quanto você gasta em luvas, máscaras, papel
  toalha, filtros e isopropílico por impressão. É um valor **fixo por peça**,
  não por hora. No FDM o padrão é zero (muita gente não usa EPI); na resina o
  padrão é R$ 2,50, porque manusear resina sem luva é um risco real.
- **Intensidade de Carbono** — gramas de CO₂ por kWh da sua rede elétrica. Não
  é um custo em dinheiro: serve para a calculadora mostrar a **pegada de
  carbono** da peça. É informativo, não entra no preço.

A pegada de carbono é calculada a partir da energia consumida:

```
energiaKwh = (potenciaW / 1000) * tempoImpressaoHoras

pegadaCarbonoGramas = energiaKwh * intensidadeCarbono
```

## Exemplo numérico passo a passo

Nossa peça-exemplo, o suporte de celular de **5,5 horas**. Você paga um slicer
de **R$ 30 por mês**, imprime **100 horas por mês**, comprou o STL por
**R$ 5**, e gasta **R$ 2 por peça** em luva e isopropílico.

```
softwarePorHora = 30 / 100 = R$ 0,30/h

software = (0,30 * 5,5) + 5 = 1,65 + 5 = R$ 6,65

ppe = R$ 2,00

ops = 6,65 + 2,00 = R$ 8,65
```

E a pegada de carbono, com a intensidade padrão de 100 g/kWh e uma impressora
de 250 W:

```
energiaKwh = (250 / 1000) * 5,5 = 1,375 kWh

pegadaCarbonoGramas = 1,375 * 100 = 137,5 g de CO2
```

Para uma peça decorativa, **R$ 8,65** de "invisíveis" é mais da metade do
custo do [material](#user-content-material) — que era R$ 16,20 (0,18 kg de PLA
a R$ 90/kg).

## Como esta seção se relaciona com as demais

- As **horas por mês** que rateiam a mensalidade são as horas produtivas da
  oficina. Elas não precisam ser iguais às horas de uso da
  [máquina](#user-content-custos-da-máquina). A máquina usa as horas da própria
  impressora; o rateio usa as horas da oficina inteira. São campos independentes,
  então valores diferentes estão corretos.
- O **tempo de impressão** que multiplica a taxa vem de
  [parâmetros](#user-content-parâmetros-de-impressão).
- Os **insumos do acabamento** (lixa, tinta) moram em
  [desgaste de hardware](#user-content-desgaste-de-hardware); aqui ficam os insumos de
  segurança e limpeza.
- O resultado é somado no bloco "Operacional & Trabalho" de
  [resultados](#user-content-resultados).

## Armadilhas práticas

1. **Slicer gratuito na vida, pago no orçamento.** Se você usa a versão
   gratuita de um slicer para vender peças, tecnicamente está usando uma
   licença não comercial. O custo de uma licença correta é real e deveria estar
   aqui — ou no preço, ou na sua consciência.
2. **Esquecer o STL pago na peça única.** É o erro inverso da diluição: em uma
   peça só, o arquivo inteiro entra. Se você vende pouco, o STL é um dos
   maiores custos da peça — e justifica cobrar mais caro na primeira venda.
3. **Zerar o EPI na resina.** A resina é tóxica e manuseada com luva. O padrão
   de R$ 2,50 por peça existe porque o isopropílico e as luvas acabam. Se você
   zera este campo "por generosidade", está subsidiando o cliente.
4. **Achar que a pegada de carbono é um custo.** A intensidade de carbono é
   apenas informação (g de CO₂). Ela não aumenta o preço — serve para você
   responder a clientes que perguntam, e para se comparar com peças
   importadas.
