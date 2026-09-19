---
title: Orçamentos
order: 3
---

# Orçamentos

A aba **Orçamentos** transforma uma estimativa em um documento que pode ser
enviado a um cliente, acompanhado do histórico e do cadastro do cliente.

## Criando um orçamento

O fluxo básico é:

1. calcule a estimativa na aba **Calculadora**
2. abra **Orçamentos** e inicie um novo orçamento a partir daquela estimativa
3. confira custos, margem e validade
4. salve e, no desktop, exporte o PDF

## Clientes

O cadastro de clientes mantém nome e contato ao lado dos orçamentos, para que o
histórico fique organizado por quem recebeu cada proposta.

## Acompanhamento

Cada orçamento registra seu estado, então é possível distinguir rapidamente:

- propostas ainda não enviadas
- propostas aguardando resposta
- propostas aprovadas ou recusadas

```
orcamento = estimativa + cliente + validade + estado
```

## Relação com a calculadora

O orçamento é uma fotografia da estimativa no momento em que foi criado: editar
a calculadora depois não reescreve o orçamento já salvo. Isso garante que o
documento enviado ao cliente continue coerente com o que foi combinado.
