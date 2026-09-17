# Modelo dos estimadores FDM (peso + tempo)

## 0. Aviso

> Estimativas para precificação (rough ±30%, viés seguro p/ cima); único dado de verdade é o fatiador (G-code). Não usar como garantia de tempo/material.
> Nomenclatura: modos `Padrão`/`Personalizada`; valor ancorado no G-code usa o badge `Preciso (G-code)`.
>
> - `Padrão`: cálculo instantâneo pelos parâmetros do perfil (aprox. ±30%).
> - `Personalizada`: ajuste fino — fator k por material + G-code real como âncora.
>   Status: vigente a partir do PR #73 (branch `pr-73-hardening`).
>   Escopo: `src/shared/lib/stlParser.ts` (`estimateMaterialVolumeCm3`,
>   `estimateWeight`), `src/shared/lib/printTimeEstimator.ts`
>   (`estimatePrintTime`), `src/shared/lib/filamentProfiles.ts`, único
>   consumidor `StlPreview.tsx`.

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

## 7. Fator empírico de geometria no tempo (D-EA3)

O tempo de §3 assume **velocidade constante**: não modela accel/jerk. Peças
pequenas/detalhadas têm muitas mudanças de direção e um travel
proporcionalmente maior, de modo que o modelo as **subestima de forma
sistemática** — a causa residual dominante de divergência após a fiação do
perfil do slicer (D-EA1).

**Decisão YAGNI:** a física de accel/jerk completa é deliberadamente diferida
(decisão registrada no plano do deepwork `estimation-accuracy`, fase D-EA3).
A aceleração real depende de firmware, junction deviation e do próprio
caminho do slicer — variáveis que uma estimativa pré-slice não tem. Em vez
disso, aplica-se um **fator bornceado e clampado** derivado da razão
**superfície/volume** (SA/V), que é o proxy mais barato de nível de detalhe:

```
SA/V = surfaceAreaMm2 / (volumeCm3 × 1000)     # mm⁻¹

fator = 1                                         se SA/V ≤ 0,2
      = 1,3                                       se SA/V ≥ 1,0
      = 1 + 0,3 × (SA/V − 0,2) / 0,8             caso contrário (rampa linear)
```

Constantes em `GEOMETRY_FACTOR` (`printTimeEstimator.ts`); curva implementada
por `geometryTimeFactor(surfaceAreaMm2, volumeCm3)`.

| Geometria       | SA/V (mm⁻¹) | Fator | Efeito            |
| --------------- | ----------- | ----- | ----------------- |
| Cubo 100 mm     | 0,06        | 1,00  | inalterado        |
| Cilindro Ø20×20 | 0,30        | 1,04  | +3,3% (movimento) |
| Cubo 10 mm      | 0,60        | 1,15  | +15% (movimento)  |
| Cubo 3 mm       | 2,00        | 1,30  | clamp             |

**Aplicação e bornceamento.** O fator multiplica **só o termo de movimento**
(extrusão + travel); o overhead de troca de camada (+2 s/camada) já é um proxy
flat do mesmo efeito e é somado intacto — o bornceamento dilui o fator no
total (cubo de 10 mm: fator 1,15 no movimento → +10,3% no total), mantendo o
resultado **dentro do envelope ±30%** em todos os casos (o clamp de 1,3 é o
próprio teto do envelope). A **âncora G-code** (modo `advanced`) não é
afetada: ela sobrescreve o resultado no final, e dado de verdade do slicer não
se mistura com fator de estimativa.

**Por que o clamp existe.** Sem ele, uma miniatura de 1 mm receberia fator
absurdo (SA/V = 6) e violaria a política de produto (±30%, viés seguro para
cima — §5). O clamp de 1,3 é calibrado no pior caso: peça minúscula/detalhada
nunca custa mais que 30% acima do estimado.

**Backward-compat e robustez.** `surfaceAreaMm2` ausente, `NaN`, ≤ 0 ou
volume inválido → fator neutro 1,0 e a estimativa é **byte-identical** à
versão sem geometria (calls existentes não quebram; zeros explícitos, nunca
NaN). Não há novo parâmetro de store — o fator é derivado puro da forma, sem
knob do usuário (YAGNI; a calibração proporcional continua com `calibrationK`,
§8, que por design não achata viés que varia com a geometria).

**Fiação (contrato).** `surfaceAreaMm2` vem do `MeshAnalysis.surfaceArea` já
calculado por `analyzeMeshFile` (mm², mesma origem do `volumeCm3`) — o
chamador (`StlPreview`) o passa exatamente como já faz para
`estimateWeight`/`estimateMaterialVolumeCm3`:

```ts
const timeEstimate = estimatePrintTime({
  volumeCm3,
  materialVolumeCm3,
  dimensions: analysis.dimensions,
  surfaceAreaMm2: analysis.surfaceArea, // D-EA3 — fator de geometria
  // ...perfil do slicer (D-EA1) e âncora (modo avançado) conforme aplicável
});
```

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

## 9. Perfil do slicer na store do Calculator — DONE (D-EA1)

`wallCount`/`lineWidthMm`/`topLayers`/`bottomLayers`/`layerHeightMm`/
`printSpeedMmPerS` agora vivem no slice persistido `fdmSlicerProfile`
(`calculatorStore.types.ts`) e são passados pelo `MaterialSection` ao
`StlPreview`, que os encaminha a `estimateWeight`/`estimateMaterialVolumeCm3`/
`estimatePrintTime`. O estimador deixou de rodar cegamente em
`VOLUME_DEFAULTS` — esses defaults permanecem apenas como fallback guardado
para entrada ausente/NaN/inválida (GA-1).

Migration-safe: estado persistido em localStorage sem o campo cai no
default-on-missing (nunca quebra estado existente); NaN/Infinity/fora-de-domínio
são descartados em `sanitizeFdmSlicerProfile` antes de chegar ao cálculo.

O byte-identical backward-compat é garantido por teste: perfil default ==
saída legada sem perfil, no mesmo mesh. O `material` (família) também passou a
ser wired — **`FILAMENT_PROFILES` é case-sensitive** (`"pla"`, não `"PLA"`), o
chamador normaliza com `.toLowerCase()`; família desconhecida cai no teto MVS
seguro.

Pendências intencionais desta fase: `purgePercent` segue hardcoded `10` no
`StlPreview` (D-EA2) e o `filamentDiameterMm` segue `1.75` (D-EA2).

## 10. G-code E paths can diverge (documented, no behavior change)

Two readers extract filament from G-code E values with different rules:

- Legacy file view (`src/shared/lib/gcodeParser.ts`, used by the `StlPreview`
  G-code file tab): tracks **max-E**, the largest absolute `E` seen on
  `G0`/`G1` moves. Simple and slicer-header friendly, but blind to resets.
- Custom anchor (`src/shared/lib/gcodeTotals.ts`, used by the Custom
  G-code anchor): **sums signed deltas** with `M82` (absolute, default) /
  `M83` (relative) plus `G92 En` resets. In absolute mode only positive
  deltas add (retraction is ignored without moving the baseline, so the
  following de-retraction nets zero); in relative mode deltas add with sign
  (negative retraction included).

Consequence: on retraction-heavy or relative-extrusion files the two paths
can report different E totals (max-E vs sum). This is expected and
documented — do NOT "fix" one to match the other without a slicer-measured
anchor. The UI surfaces this note under the Custom G-code upload
(`stl.gcodeEPathsNote`).
