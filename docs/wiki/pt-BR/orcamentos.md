---
title: Orçamentos
order: 21
tourId: orcamentos-clientes
---

# Orçamentos

A aba **Orçamentos** transforma uma estimativa em um documento: com número,
cliente, validade e estado. É o que você envia, o que arquiva e o que consulta
depois para saber o que foi combinado com cada cliente.

Cada orçamento é gerado a partir de estimativas que já existem no app — ele
não recalcula nada, só organiza o que a [Calculadora](#user-content-calculadora)
já produziu.

## Do cálculo ao documento

O fluxo completo:

1. calcule a peça na aba **Calculadora** e salve a estimativa no **Histórico**
2. em **Orçamentos**, abra **Novo Orçamento** e dê um título
3. adicione itens a partir do Histórico e ajuste quantidades e descontos
4. escolha o cliente, a validade e as condições de pagamento
5. salve — o orçamento nasce como **Rascunho**, com um número sequencial próprio

O número é automático e contínuo: `Orçamento #001`, `#002`, `#003`. Não há
buraco quando você exclui um — a sequência só anda para frente.

## Os itens vêm do Histórico

Um orçamento não aceita digitar preço de cabeça. Você adiciona itens
diretamente das estimativas salvas no Histórico, e o **preço unitário** de
cada item é o preço de venda daquela estimativa.

A partir daí, tudo é editável: a quantidade, o preço unitário e um desconto
porcentual só para aquele item. Se a estimativa original dizia R$ 42,70 e você
fechou R$ 45,00, é só ajustar na linha — o orçamento reflete o acordado, não
a estimativa.

## O que o orçamento carrega

Além dos itens, o formulário guarda:

- **Título**, que identifica o orçamento na lista e na busca
- **Cliente**, opcional — veja [Clientes](#user-content-clientes)
- **Válido até**, a data em que a proposta expira
- **Condições de pagamento**, do tipo "50% entrada, 50% na entrega"
- **Previsão de entrega**, em dias ou data combinada
- **Observações**, um texto livre no rodapé do documento
- **Desconto global**, uma porcentagem aplicada sobre o subtotal inteiro

## Descontos e totais

Os números do rodapé são calculados automaticamente:

```
subtotal       = soma de (quantidade * preco unitario) de cada item
desconto       = subtotal * desconto global / 100
total          = subtotal - desconto
```

O desconto pode vir de duas formas: por item (na própria linha) ou global
(sobre tudo). Os dois se acumulam, e o app sempre mostra o valor do desconto
em dinheiro, não só a porcentagem — para você sentir o tamanho do abatimento
antes de enviar.

## Os quatro estados

Cada orçamento tem um estado, visível numa etiqueta colorida e editável direto
no documento:

- **Rascunho** — criado e ainda não enviado. É o estado inicial.
- **Enviado** — você mandou para o cliente e aguarda resposta.
- **Aprovado** — o cliente aceitou; é o sinal para produzir.
- **Recusado** — o cliente não aceitou; serve de registro para renegociar.

O estado é um compromisso seu com a realidade, não um aviso automático: o app
não envia e-mail e não sabe se o cliente leu. Quando você muda o estado, está
anotando o que aconteceu.

## O orçamento é uma fotografia

No momento em que você salva, o orçamento congela três coisas: o preço de cada
item, os dados do cliente (nome, empresa, e-mail e telefone) e as condições.
Esse retrato viaja junto com o documento.

Por isso, recalcular a peça na calculadora **não reescreve** o orçamento já
salvo. Se o preço do filamento subir, a estimativa nova sai mais cara, mas o
orçamento que o cliente recebeu continua dizendo o que foi combinado.

```
orcamento = estimativa + cliente + validade + estado (congelados no salvamento)
```

Isso existe de propósito. Sem o snapshot, qualquer ajuste na calculadora
reescreveria documentos já enviados, e o que o cliente tem na mão deixaria de
corresponder ao que você vê no app.

## Exportar o PDF

Abra qualquer orçamento e use **Exportar PDF** para gerar o arquivo com
layout pronto para envio, já nomeado como `orcamento_001.pdf`. A exportação é
bloqueada durante uma sessão demo — o selo ao lado do botão avisa quando é o
caso.

## Acompanhando a lista

A aba lista todos os orçamentos com estado e totais, e a busca filtra por
título ou nome do cliente. Excluir pede confirmação, porque o número daquele
orçamento não vai ser reaproveitado.

## Exemplo de ponta a ponta

1. Você calcula **Suporte para motor N20**: preço de venda sugerido
   R$ 42,70. Salva no Histórico.
2. Calcula também **Caixa para Raspberry**: R$ 68,00. Salva.
3. Abre **Novo Orçamento**, título "Lote de peças — Centro Modelos".
4. Adiciona o suporte, quantidade 2: R$ 85,40.
5. Adiciona a caixa, quantidade 1: R$ 68,00.
6. Subtotal: **R$ 153,40**. Aplica desconto global de 5%: R$ 7,67.
7. Total: **R$ 145,73**, válido por 30 dias, pagamento em duas vezes.
8. Salva. Vira `Orçamento #001` como Rascunho.
9. Manda para o cliente e muda o estado para **Enviado**.
10. Cliente aceita: estado **Aprovado**. É só produzir.

Seis meses depois, o orçamento #001 ainda mostra R$ 145,73 — mesmo que você
tenha recalculado a peça dezenas de vezes desde então.
