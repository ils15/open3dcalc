---
title: Dashboard
order: 23
tourId: dashboard-kpis
---

# Dashboard

O **Dashboard** é onde o app junta suas estimativas e mostra se o trabalho está
pagando. Custo, lucro, margem e tendência em uma só tela.

Vale mais que qualquer gráfico uma regra: **o dashboard não inventa número**.
Tudo o que aparece ali vem das estimativas que você salvou no **Histórico**,
somadas à estimativa que está aberta na
[Calculadora](#user-content-calculadora). Ele não lê orçamentos, não lê
faturamento e não consulta nenhum sistema externo.

Por isso a primeira visita costuma mostrar os gráficos vazios com a mensagem
**"Sem dados de histórico"**. Não é defeito nem configuração faltando — é o
estado normal de quem acabou de instalar. Salve três estimativas no Histórico,
volte aqui, e a mesma tela está preenchida.

## KPIs da estimativa ativa

O primeiro grupo de números acompanha a peça aberta na calculadora. Cada um
responde a uma pergunta diferente:

- **Custo Total** — quanto a peça custa para sair
- **Preço de Venda** — o preço que a calculadora sugere
- **Lucro Líquido** — venda menos custo, em dinheiro
- **ROI** — o retorno sobre o dinheiro investido
- **Ponto de Equilíbrio** — quantas peças pagam o custo fixo do mês
- **Receita no Equilíbrio** — o faturamento desse ponto
- **Projeção Mensal** — o lucro se você mantiver o ritmo de produção

O ROI é a porcentagem que o dinheiro investido rende:

```
ROI = (lucro liquido / custo total) * 100
```

Uma peça que custa **R$ 20,00** e é vendida por **R$ 30,00** deixa R$ 10,00 de
lucro. O ROI é `(10 / 20) * 100 = 50%`: cada real investido rende cinquenta
centavos limpos.

O ponto de equilíbrio mostra quando a operação deixa de perder dinheiro:

```
ponto de equilibrio = ceil(custo fixo mensal / margem por unidade)
```

Com **R$ 600,00** de custo fixo no mês e **R$ 10,00** de margem por peça, são
`ceil(600 / 10) = 60 peças`. A receita desse ponto é `60 * R$ 30,00`, ou seja,
**R$ 1.800,00** de faturamento só para empatar.

Quando a margem por unidade fica negativa, o app não calcula e avisa: peça
vendida abaixo do custo não tem ponto de equilíbrio, e a meta vira um aviso em
vez de meta.

A projeção mensal leva o lucro da peça até a quantidade que você pretende
produzir. Mantendo 100 unidades no exemplo, são `100 * R$ 10,00 = R$ 1.000,00`
de lucro projetado para o mês.

## KPIs do histórico

O segundo grupo olha para trás e considera só o período dos filtros. Quatro
números resumem o que já passou pela calculadora:

- **Lucro Total** — a soma do lucro de cada estimativa do período
- **Custo Médio por Impressão** — a média dos custos individuais
- **Margem Média** — a média das margens de cada estimativa
- **Total de Impressões** — quantas estimativas entram na conta

A margem média não é o lucro total dividido pela receita. Cada estimativa
calcula a sua primeiro, e a média vem depois:

```
margem media = media de (lucro / preco de venda * 100) de cada estimativa
```

É a mesma conta da peça única, repetida em cada item. Por isso uma peça barata
de margem alta move o número tanto quanto uma peça cara.

Imagine três estimativas salvas no mês:

- **Suporte N20** — custo R$ 18,00, venda R$ 42,70, lucro **R$ 24,70**
- **Caixa para Raspberry** — custo R$ 41,00, venda R$ 68,00, lucro **R$ 27,00**
- **Tag de identificação** — custo R$ 1,20, venda R$ 8,00, lucro **R$ 6,80**

O lucro total é **R$ 58,50** e o total de impressões é **3**. O custo médio por
impressão fica `(18,00 + 41,00 + 1,20) / 3 = R$ 20,07`. As margens individuais
são 57,8%, 39,7% e 85,0%, o que dá **margem média de 60,8%**.

### Filtros de período

Os filtros de data inicial e final escolhem o que entra na conta. Estreite o
período para um trimestre e você vê só ele; limpe os filtros e a volta é para o
histórico inteiro. Tudo no segundo grupo de KPIs e nos gráficos acompanha a
mesma janela.

## Gráficos

Quatro gráficos traduzem o histórico em imagem. Cada um responde a uma
pergunta:

- **Tendência de Lucro** — o lucro está subindo ou baixando?
- **Impressoras com Mais Lucro** — qual máquina paga a conta?
- **Materiais Mais Usados** — onde está indo o seu filamento?
- **Comparação de Períodos** — este mês está melhor que o anterior?

A **Tendência de Lucro** é um gráfico de área com o lucro ao longo do tempo. A
leitura mais útil não é o ponto mais alto, e sim a direção: uma curva que
cresce devagar já é sinal de que a precificação merece atenção.

**Impressoras com Mais Lucro** e **Materiais Mais Usados** mostram o top 5 de
cada. Quando uma máquina aparece no topo, é ela que deve receber a próxima
peça; quando um material domina, é o que vale negociar em maior quantidade.

A **Comparação de Períodos** é um gráfico de pizza com o mês atual ao lado do
anterior. Se o mês soma R$ 850,00 e o anterior R$ 620,00, as fatias ficam 58%
e 42% — a predominância do mês atual já diz que o período está melhor.

## Metas e alertas

Você define uma **meta de lucro mensal** e o app guarda na sua máquina, na
chave `open3dcalc_dashboard_goal`. A partir dela é calculada a quantidade de
peças necessária:

```
pecas necessarias = meta de lucro / lucro por peca
```

Com meta de **R$ 2.000,00** e lucro de **R$ 10,00** por peça, são 200 peças no
mês. Se a margem por unidade estiver negativa, nenhuma quantidade resolve —
por isso o app avisa em vez de mostrar um número sem sentido.

Os **alertas de margem baixa** marcam as estimativas com margem abaixo de 20%.
Uma peça vendida por **R$ 25,00** com custo de **R$ 21,00** tem margem de 16% e
entra na lista. Não é uma proibição: é onde o dinheiro está escapando sem
alarde.

## Exportar o relatório

O **Relatório Executivo** sai em PDF. A exportação usa o `html2canvas` para
capturar o gráfico de tendência e monta o documento com os KPIs do período, o
top de impressoras, o top de materiais e a comparação entre os dois meses.

É o arquivo que você manda para um sócio ou guarda como registro do período,
sem que ninguém precise instalar nada para ler.

## Começando do zero

Se o dashboard está vazio, o caminho é curto:

1. calcule uma peça na aba [Calculadora](#user-content-calculadora)
2. salve a estimativa no **Histórico**
3. repita com mais duas peças, de preferência de materiais diferentes
4. volte ao dashboard — KPIs e gráficos já têm o que mostrar

O dashboard é um espelho do seu cadastro de estimativas. Não existe atalho para
preenchê-lo, mas também não existe segredo: cada estimativa salva é mais um
dado na tela.
