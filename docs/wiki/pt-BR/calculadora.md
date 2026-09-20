---
title: Calculadora
order: 1
---

# Calculadora

A **Calculadora** é o núcleo do Open3DCalc: ela estima o custo de uma impressão
3D a partir de poucos dados de entrada e divide o resultado em seções
auditáveis, sem esconder como cada valor é composto.

## Níveis básico e avançado

A calculadora tem dois níveis de detalhe:

- **Básico**: apenas as informações essenciais, para uma estimativa rápida.
- **Avançado**: revela todas as seções de custo, do material ao preço de venda.

Mudar de nível não apaga nada do que já foi preenchido.

## Seções de custo do nível avançado

Cada estimativa avançada é composta por seções independentes:

1. `material` — filamento consumido, incluindo falhas e retrabalho.
2. `hardware` — amortização dos componentes da impressora.
3. `machine` — tempo de máquina e consumo de energia.
4. `fixedCost` — custos fixos rateados, como aluguel e manutenção.
5. `labor` — mão de obra do preparo e do pós-processamento.
6. `ops` — insumos e operação adicionais.
7. `sales` — impostos, taxas e margem de venda.
8. `results` — consolidação e preço final sugerido.

## Preço de venda

A seção `results` mostra o custo total e o preço de venda sugerido lado a lado,
para que a margem seja uma escolha consciente e não um arredondamento oculto.

```
custo total = material + hardware + machine
            + fixedCost + labor + ops
preco de venda = custo total + sales
```
