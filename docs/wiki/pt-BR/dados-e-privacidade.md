---
title: Dados & Privacidade
order: 25
---

# Dados & Privacidade

Tudo o que você cadastra e salva no Open3DCalc vive **no seu dispositivo** —
no perfil do navegador (web) ou no banco local do aplicativo (desktop). Nada é
enviado a servidores. A tela **Privacidade** documenta isso e é também o
painel de controle dos seus dados.

## O que fica local

- Cálculos salvos, clientes, orçamentos, produtos, catálogo e estoque ficam em
  chaves locais legíveis — sem criptografia adicional do aplicativo. Quem
  acessar o seu perfil poderá lê-los; quem não acessar, não vê nada.
- Nenhum dado sai do dispositivo: não há login, sincronização em nuvem nem
  telemetria.

## Levar e trazer seus dados

Na tela **Privacidade**, a seção **"Levar e trazer seus dados"** exporta um
arquivo JSON **legível** com tudo (histórico, clientes, orçamentos, catálogo,
estoque, produtos, tema) e um **checksum** de integridade. Importar aceita
esse arquivo em dois modos:

- **Mesclar** — soma os registros ao que já existe, preservando os dois;
- **Substituir** — apaga o atual antes de importar (pede confirmação).

Isso é o seu backup: exporte periodicamente e guarde o arquivo.

## Importar dados do perfil de teste (Beta)

Se você usou o canal Beta neste navegador, seus dados de teste (clientes,
orçamentos e histórico) ficaram num perfil separado. A seção **"Importar dados
do perfil de teste"** traz esses registros para o perfil estável com um
clique: prévia por tipo, IDs preservados, duplicatas ignoradas e a fonte de
teste **sempre preservada** — importar não apaga o Beta.

## Modo demo

O **modo demo** carrega uma oficina de exemplo ("Estúdio Maria Print") por
cima dos seus dados, com um aviso permanente na tela e o selo **[DEMO]** no
título da aba. Ao sair, seus dados reais voltam byte a byte — o demo nunca
escreve neles.

## Apagar

A exclusão de dados é por escopo e sempre confirmada: você apaga o que escolheu
(clientes, histórico, tudo) e recebe um relatório do que foi removido.
