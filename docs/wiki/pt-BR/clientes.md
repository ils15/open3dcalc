---
title: Clientes
order: 22
---

# Clientes

A aba **Clientes** é o cadastro de quem recebe suas propostas. Nome, contato
e observações — pouco mais que isso, mas no lugar certo.

Sem ela, o histórico de orçamentos vira uma pilha de números sem dono. Com
ela, você sabe quantas propostas mandou para cada cliente, o que cada uma
valia e qual foi a resposta.

## O cadastro

Cada cliente tem:

- **Nome** — obrigatório, é o que aparece na lista e no orçamento
- **Empresa** — opcional, útil quando a pessoa compra para um CNPJ
- **Email** — opcional, mas validado: `joao@empresa` é recusado, é preciso um
  domínio completo, como `joao@empresa.com`
- **Telefone**
- **Endereço**
- **Observações** — o que ajudar: preferências, kombinações, quem indicou

O email é o único campo com validação. Os demais você preenche como quiser —
um cliente pode ter só o nome e o WhatsApp.

## Por que manter aqui

O orçamento é um documento, e documento precisa de destinatário. Quando o
cliente está cadastrado, você o escolhe num seletor em vez de digitar; quando
não está, o orçamento segue sem cliente — e some no meio da lista.

O cadastro também conta histórico. Cada cliente mostra **quantos orçamentos**
já recebeu, e a busca filtra por nome, empresa ou email. Em um minuto você
responde "quanto já propus para a Centro Modelos este ano?" sem abrir
planilha nenhuma.

## Vinculando a um orçamento

O fluxo é simples:

1. cadastre o cliente aqui, com nome e pelo menos um contato
2. em [Orçamentos](#user-content-orçamentos), abra o orçamento e escolha o
   cliente no seletor
3. salve — o orçamento grava o vínculo e uma **cópia** dos dados de contato
4. o contador de orçamentos do cliente sobe sozinho

A cópia é proposital: se você corrigir o email do cliente amanhã, os
orçamentos antigos mantêm o contato que estava valendo quando foram enviados.
O vínculo (id) continua apontando para o cadastro atual; o que congela é o
texto do documento.

## Acompanhando o histórico

A lista mostra cada cliente com seu contador de orçamentos, e a busca aceita
nome, empresa ou email. Editar e excluir estão ali mesmo — excluir pede
confirmação, porque os orçamentos já vinculados continuam existindo, só
perdem o vínculo.

## Importar e exportar

O cadastro inteiro pode ser exportado como JSON para backup, e importado de
volta em outra máquina. A exportação é bloqueada na sessão demo, como nas
outras abas — o selo avisa quando é o caso.

## Exemplo: o que o histórico revela

Você cadastra a **Centro Modelos** (empresa) com a Joana como contato. Nos
dois meses seguintes gera quatro orçamentos vinculados a ela:

- `#001` Lote de peças — **R$ 145,73** — Aprovado
- `#004` Caixas de proteção — **R$ 320,00** — Aprovado
- `#007` Suporte em lote — **R$ 89,00** — Enviado
- `#009` Peça única — **R$ 58,00** — Recusado

Na aba Clientes, o contador da Centro Modelos mostra **4**. Somando os dois
aprovados, são **R$ 465,73** em pedidos confirmados com um único cliente —
informação que muda como você atende o próximo orçamento dela: cliente que
compra duas vezes merece resposta rápida e condição melhor que a de estranho.

É também o aviso mais barato do mundo: dos **R$ 612,73** propostos,
**R$ 58,00** voltaram como recusados e **R$ 89,00** ainda aguardam resposta.
Olhar por cliente mostra onde o preço está sendo recusado — antes que vire
hábito.
