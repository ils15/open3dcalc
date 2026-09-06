# Modelo dos estimadores FDM (peso + tempo)

## 0. Aviso

> Estimativas para precificação (rough ±30%, viés seguro p/ cima); único dado de verdade é o fatiador (G-code). Não usar como garantia de tempo/material.
> Nomenclatura: modos `Padrão`/`Personalizada`; valor ancorado no G-code usa o badge `Preciso (G-code)`.
> - `Padrão`: cálculo instantâneo pelos parâmetros do perfil (aprox. ±30%).
> - `Personalizada`: ajuste fino — fator k por material + G-code real como âncora.
> Status: vigente a partir do PR #73 (branch `pr-73-hardening`).
> Escopo: `src/shared/lib/stlParser.ts` (`estimateMaterialVolumeCm3`,
> `estimateWeight`), `src/shared/lib/printTimeEstimator.ts`
> (`estimatePrintTime`), `src/shared/lib/filamentProfiles.ts`, único
> consumidor `StlPreview.tsx`.

## 1. Fórmula canônica

Padrão consagrado das calculadoras (Meshy/ThisCalc):

```
shell  = min(volume, área × espessura_casca)
inner  = max(0, volume − shell)
total  = shell + inner × infill + suporte
peso   = total × (1 + purga) × densidade
```

## 2. Casca derivada do perfil (sem 0,84 fixo)

```
espessura_casca = wallCount × lineWidthMm + (topLayers + bottomLayers) × layerHeightMm / 2
```

Defaults: `wallCount = 2`, `lineWidthMm = 0,42`, `topLayers = 4`,
`bottomLayers = 4`, `layerHeightMm = 0,2` → casca padrão 1,64 mm.
`shellThicknessMm` explícito vence a derivação (válvula de escape, não regra).

A divisão por 2 no termo topo/base assume que as áreas projetadas de topo e
base somam ~metade da superfície total. É aproximação documentada, com **viés
deliberado de superestimação** (ver §5).

## 3. Física da extrusão + teto MVS

O tempo usa o caminho do BICO (`volume / (layerH × lineW)`), não o
comprimento de filamento (erro de ~30× corrigido no PR #73). A vazão
`Q = layerH × lineW × speed` é clamped no MVS do material:

| Material     | Densidade (g/cm³) | MVS (mm³/s)      |
| ------------ | ----------------- | ---------------- |
| PLA          | 1,24              | 15               |
| PETG         | 1,27              | 12               |
| ABS          | 1,04              | 12               |
| ASA          | 1,05              | 12               |
| TPU          | 1,21              | 5                |
| Nylon        | 1,14              | 10               |
| Desconhecido | PLA (fallback)    | 10 (teto seguro) |

`material` é input com default PLA; `densityGcm3` explícito (store) vence a
tabela. Travel = 25% da distância de extrusão a 150 mm/s (aproximação
pré-slice → overhead efetivo de ~10–15%), +2 s por troca de camada.

## 4. Inputs padrão

`infillPercent = 20`, speeds 60/150 mm/s, `purgePercent = 0` (o chamador
— hoje `StlPreview` — passa 10), `travelRatio = 0,25`. Sem área de malha,
cai no legado `volume × (0,2 + 0,8 × infill)`. Geometria inválida
(volume ≤ 0/NaN, altura ≤ 0) retorna **zeros explícitos**, nunca NaN.

## 5. Premissas e limites

- Saídas rotuladas `rough_estimate`: aproximação **pré-slice, ±30%**. Só um
  fatiador crava peso/tempo (retrações, saltos, aceleração e suportes reais).
- **Política de superestimação explícita**: nas dúvidas o modelo erra para
  cima (teto MVS seguro, casca com topo/base cheio, fallback no volume
  maciço). Motivo: margem de preço — subestimar dá prejuízo, superestimar
  dá gordura.
- Quebras intencionais (sem compat): `estimateMaterialVolumeCm3`/
  `estimateWeight` posicionais → objeto `EstimateOptions`; `PrintTimeParams`
  renomeado para sufixos canônicos (`layerHeightMm`, `printSpeedMmPerS`) e
  sem params-fantasma (`wallCount`, `infillPercent`, `printerPowerWatts`,
  `nozzleDiameterMm`, `topBottomLayers` removidos — só alimentavam o rótulo
  de confiança). Único caller externo era o `StlPreview`, migrado junto.
  `DEFAULT_SHELL_THICKNESS_MM` removido.

## 6. Pendência pós-merge #72 — RE-MEDIÇÃO DA LITOFANIA (NÃO FAZER AGORA)

A âncora da litofania (92,52 cm³ / 72,8 cm³ no BambuStudio) foi medida com o
volume **pré-correção do #72**. Após o merge do #72, re-medir o mesmo projeto
e atualizar os testes/§2 se os números deslocarem. Os testes atuais ancoram
o _comportamento_ (saturação no volume), não a medição exata, de propósito.

## 8. Calibração k — só viés proporcional sistemático

`calibrationK` (modo `advanced`) corrige SÓ viés proporcional sistemático —
ex.: o slicer sempre estima 8% abaixo, em qualquer tamanho. Procedimento:
`k = actual/estimated` por job, usa a MEDIANA de ≥ 10 jobs do MESMO perfil
(impressora + material + perfil de fatiamento); nunca reaproveitar k entre
materiais (densidade/MVS distintos quebram a proporcionalidade).

Para tempo com overhead fixo (heating/probing), o modelo é `t_real = t_fixo

- k·t_slicer`: estima `t_fixo` (minutos de aquecimento + sondagem, medido 1×
  por impressora) e calibra k só sobre a parcela proporcional. k puro sobre o
  total superestima peças curtas e subestima as longas.

k NÃO corrige viés geométrico (ver comentário em `calibrationK`,
`src/shared/types/estimation.ts`): o termo de arestas varia com o tamanho
(+13% no cubo de 10 mm vs +0,4% no de 100 mm) e nenhum k único achata essa
curva — isso se corrige na fórmula, não no fator.

## 9. Follow-up — fiação wall/lineWidth na store do Calculator (NÃO FEITO)

`wallCount`/`lineWidthMm` hoje vivem só nos defaults do estimador
(`VOLUME_DEFAULTS`); a store do Calculator (`calculatorStore.types.ts`) não
tem esses campos — só `infillPercent`. Ligar o perfil de impressão da UI aos
estimadores exige adicionar `wallCount`/`lineWidthMm` (e, por coerência,
`topLayers`/`bottomLayers`/`layerHeightMm`) à store, fora do escopo deste PR.
Até lá, `StlPreview` segue com os defaults documentados no §2.
