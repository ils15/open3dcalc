/**
 * Totais puros de um G-code: filamento extrudado (E) + tempo de cabeçalho.
 *
 * Cobre o que o slicer sabe e o pré-slice não: soma E de `G0`/`G1` com
 * `M82` (absoluto, default) / `M83` (relativo) e resets `G92 En`, mais
 * `;TIME:segundos` (Cura) e `; estimated printing time ... = Xh Ym Zs`
 * (Prusa/Orca). Sem regex catastrófico: só prefixos e um `\d` simples por
 * linha. Caps anti-DoS com erro amigável (pt-BR).
 */

export interface GcodeTotals {
  /** Filamento total extrudado em mm (soma de E). */
  extrudedMm: number;
  /** Peso estimado em gramas (Ø 1,75 mm, PLA 1,24 g/cm³). */
  extrudedGrams: number;
  /** Tempo de cabeçalho em minutos, quando o G-code informa. */
  timeMinutes?: number;
}

export interface ParseGcodeTotalsOptions {
  /** Teto de tamanho em chars (default 50MB). */
  maxChars?: number;
  /** Teto de linhas (default 2_000_000). */
  maxLines?: number;
  /** Diâmetro do filamento em mm (default 1,75). */
  filamentDiameterMm?: number;
  /** Densidade em g/cm³ (default 1,24 PLA). */
  densityGcm3?: number;
}

const DEFAULT_MAX_CHARS = 50 * 1024 * 1024;
const DEFAULT_MAX_LINES = 2_000_000;

/** `E(-)12.34` — um número por linha, sem backtracking. */
function readEValue(token: string): number | undefined {
  const idx = token.indexOf("E");
  if (idx === -1) return undefined;
  const rest = token.slice(idx + 1);
  const m = /^(-?\d+(?:\.\d+)?)/.exec(rest);
  if (!m) return undefined;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) ? v : undefined;
}

/** `;TIME:7200` → 120. Retorna undefined quando não é header de tempo. */
function readTimeHeaderSeconds(trimmed: string): number | undefined {
  if (!trimmed.startsWith(";TIME:")) return undefined;
  const v = parseFloat(trimmed.slice(6).trim());
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/** `... = 1h 23m 45s` (d/h/m/s) → segundos. Só após o `=`. */
function readEstimatedPrintingTimeSeconds(trimmed: string): number | undefined {
  if (!trimmed.toLowerCase().includes("estimated printing time")) {
    return undefined;
  }
  const eq = trimmed.indexOf("=");
  if (eq === -1) return undefined;
  const part = trimmed.slice(eq + 1);
  const re = /(\d+)\s*([dhms])/gi;
  let total = 0;
  let m: RegExpExecArray | null;
  // Guarda anti-loop: no máximo 16 pares por linha de comentário.
  let guard = 0;
  while ((m = re.exec(part)) !== null && guard++ < 16) {
    const val = parseInt(m[1], 10);
    if (!Number.isFinite(val)) continue;
    const unit = m[2].toLowerCase();
    if (unit === "d") total += val * 86400;
    else if (unit === "h") total += val * 3600;
    else if (unit === "m") total += val * 60;
    else total += val;
    // Evita loop vazio em regex global sem avanço.
    if (m[0].length === 0) re.lastIndex++;
  }
  return total > 0 ? total : undefined;
}

/**
 * Soma E + lê tempo de cabeçalho. Pura, sem I/O.
 *
 * @throws Error amigável quando passa dos caps (`maxChars`/`maxLines`).
 */
export function parseGcodeTotals(
  gcodeText: string,
  options: ParseGcodeTotalsOptions = {},
): GcodeTotals {
  const {
    maxChars = DEFAULT_MAX_CHARS,
    maxLines = DEFAULT_MAX_LINES,
    filamentDiameterMm = 1.75,
    densityGcm3 = 1.24,
  } = options;

  if (typeof gcodeText !== "string") {
    throw new Error("G-code inválido: esperado texto.");
  }
  if (gcodeText.length > maxChars) {
    throw new Error(
      `G-code muito grande (${(gcodeText.length / 1024 / 1024).toFixed(1)} MB, limite ${(maxChars / 1024 / 1024).toFixed(0)} MB). Envie um trecho menor.`,
    );
  }

  let absolute = true; // M82 (default) vs M83
  // Eprev: última referência absoluta. `G92 En` redefine Eprev sem somar.
  // M82 soma só delta = E − Eprev quando delta > 0; retração (E recua sem
  // zerar) é ignorada SEM mover Eprev, então o desretrair seguinte dá
  // delta 0 — líquido zero, sem inflar o total. Restart implícito sem G92
  // (troca de spool zera o E: E cai para ≤ 0) rebasa Eprev sem somar.
  let lastRawE = 0;
  let totalMm = 0;
  let timeMinutes: number | undefined;

  let lineCount = 0;
  let start = 0;
  const n = gcodeText.length;

  // Iteração manual por linha: evita `split` de arquivo gigante.
  const visitLine = (line: string): void => {
    lineCount++;
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    const timeS = readTimeHeaderSeconds(trimmed);
    if (timeS !== undefined && timeMinutes === undefined) {
      timeMinutes = Math.round(timeS / 60);
      return;
    }
    const estS = readEstimatedPrintingTimeSeconds(trimmed);
    if (estS !== undefined && timeMinutes === undefined) {
      timeMinutes = Math.round(estS / 60);
      return;
    }

    // Remove comentário final (`G1 X0 E1 ; comentário`) antes de ler o comando.
    const semi = trimmed.indexOf(";");
    const code = (semi === -1 ? trimmed : trimmed.slice(0, semi)).trim();
    if (code.length === 0) return;
    const upper = code.toUpperCase();

    if (upper === "M82") {
      absolute = true;
      return;
    }
    if (upper === "M83") {
      absolute = false;
      return;
    }
    if (upper.startsWith("G92")) {
      // `G92 En` redefine Eprev sem somar: próxima extrusão conta de n.
      const e = readEValue(upper);
      if (e !== undefined) lastRawE = e;
      return;
    }
    // Movimento linear G0/G00/G1/G01 (com ou sem espaço: `G1X0E1` vale).
    // O lookahead rejeita G10/G11/G28 (`G` + dígitos diferentes de 0/1).
    if (!/^G(0{1,2}|1{1,2})(?![0-9])/u.test(upper)) return;
    const e = readEValue(upper);
    if (e === undefined) return;
    if (absolute) {
      if (e <= 0 && e < lastRawE) {
        lastRawE = e; // restart implícito (spool zerou o E): rebasa sem somar
      } else if (e > lastRawE) {
        totalMm += e - lastRawE; // delta > 0 soma; retração dá delta ≤ 0
        lastRawE = e;
      }
      // Retração: ignora SEM mover Eprev (desretrair → delta 0, líquido zero).
    } else {
      // M83 relativo: soma deltas COM SINAL (retração negativa inclusa).
      totalMm += e;
    }
  };

  for (let i = 0; i <= n; i++) {
    if (i === n || gcodeText[i] === "\n") {
      // Linha sem o `\n`; tolera `\r` do Windows.
      let line = gcodeText.slice(start, i);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      visitLine(line);
      if (lineCount > maxLines) {
        throw new Error(
          `G-code com muitas linhas (limite ${maxLines.toLocaleString("pt-BR")}). Envie um trecho menor.`,
        );
      }
      start = i + 1;
    }
  }

  // Clamp: total nunca negativo (G-code malformado com saldo negativo).
  if (!(totalMm > 0)) totalMm = 0;

  const radiusMm = filamentDiameterMm / 2;
  const volumeCm3 =
    totalMm > 0 ? (Math.PI * radiusMm * radiusMm * totalMm) / 1000 : 0;

  const result: GcodeTotals = {
    extrudedMm: totalMm,
    extrudedGrams: volumeCm3 * densityGcm3,
  };
  if (timeMinutes !== undefined) result.timeMinutes = timeMinutes;
  return result;
}
