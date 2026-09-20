---
title: Inventário
order: 2
---

# Inventário

A aba **Inventário** cataloga filamentos e máquinas para que a calculadora use
valores reais em vez de estimativas genéricas. Um catálogo bem cuidado é o que
faz a diferença entre um chute e um custo confiável.

## Filamentos

Cada filamento guarda os dados que alimentam a seção `material`:

- diâmetro e densidade do material
- preço pago e quantidade do rolo
- temperatura de extrusão recomendada

## Máquinas

Cada máquina descreve o hardware que será amortizado na seção `hardware`:

- custo de aquisição da impressora
- horas de vida útil estimadas
- consumo elétrico em Watts

## Como o inventário entra na estimativa

Ao selecionar um filamento e uma máquina já catalogados, a calculadora
substitui os valores padrão pelos seus:

```
custo material = (peso da peca + peso das falhas) * preco por grama
custo hardware = (horas de uso / vida util) * preco da maquina
```

Manter o inventário atualizado é a forma mais barata de ganhar precisão.
