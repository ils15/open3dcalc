# Créditos de dados / Data credits

Atribuição de dados externos e esclarecimento sobre arte e marcas usadas no
Open3DCalc. Referenciado por [`README.md`](../README.md) e por
[`scripts/enrich-printers.mjs`](../scripts/enrich-printers.mjs).

## Dados técnicos de impressoras 3D

Os campos técnicos do catálogo de impressoras (`technology`, `buildVolumeMm`,
`nozzleDiameterMm`, `maxSpeedMmS`) são adaptados do banco de dados comunitário:

- **Fonte:** [swordlab/open-3d-printer-database](https://github.com/swordlab/open-3d-printer-database)
- **Licença:** [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) —
  Creative Commons Attribution 4.0 International

## Imagens das impressoras (biblioteca de modelos)

As imagens dos 103 modelos da biblioteca vivem localmente em
`public/images/printers/`:

- **55 fotos reais** obtidas no [Wikimedia Commons](https://commons.wikimedia.org),
  todas livremente licenciadas (CC0, CC BY, CC BY-SA ou domínio público).
  Atribuição completa **por foto** (fonte, autor, licença, data de acesso)
  no manifesto embarcado: [`public/images/printers/manifest.json`](../public/images/printers/manifest.json).
- **48 cards de marca** como arte original Open3DCalc (banda com a cor da
  casa + wordmark + nome do modelo — sem logos de fabricante), para os
  modelos sem foto livre.

Fotos de produto dos fabricantes não são usadas: seguem protegidas por
direito autoral. O padrão do projeto é arte original ou foto livre com
atribuição (precedente: foto CC BY-SA do Prusa MK4, card #252).

> **Nota de adaptação:** apenas os dados **técnicos** listados acima foram
> importados (technology, build volume, nozzle, max speed). Os dados
> **econômicos** (preços em R$, consumo de energia, vida útil e manutenção por
> hora) **NÃO** foram importados — permanecem os valores nacionais curados pelo
> app, que divergem das figuras em EUR do banco original (cujo `power_w`
> representa o pico da fonte, e não o consumo típico). O processo de merge está
> implementado em `scripts/enrich-printers.mjs`.

## Arte visual

- A arte de _fallback_ dos impressores (`public/images/printers/fallback-fdm.svg`
  e `public/images/printers/fallback-resin.svg`) é **obra original** deste
  projeto — não é logo ou marca registrada de terceiros.
- A arte SVG dos marketplaces (`public/images/marketplaces/*.svg`) é igualmente
  **original** do projeto: são ilustrações estilizadas criadas para identificação
  visual das opções, não logos oficiais ou marcas registradas.

## Marcas

Nomes de fabricantes de impressoras e de marketplaces são citados neste projeto
apenas para **identificação de produtos** (uso nominativo — _nominative fair
use_). Todas as marcas pertencem a seus respectivos donos; o Open3DCalc não é
afiliado a eles e não possui endosso de nenhuma das partes citadas.
