#!/usr/bin/env node
/**
 * push-gate.mjs — gate de testes do pre-push no modo "não piorou".
 *
 * Por que existe: `.husky/pre-push` rodava `npm run test:run` exigindo zero
 * falhas, sem nenhuma variável de escape. Com `main` vermelho por 12 arquivos
 * de teste, esse gate travou o repo três vezes no mesmo dia — um push exigiu
 * `--no-verify` e dois merges exigiram bypass de administrador de checks.
 * Exigir zero falhas num gate cujo vermelho é herança de outra fatia só ensina
 * o time a usar `--no-verify`.
 *
 * O que este script faz: compara a execução atual com
 * `scripts/push-gate-baseline.json` e bloqueia apenas REGRESSÃO NOVA:
 *
 *   1. bloqueia se algum arquivo que falha NÃO está no baseline;
 *   2. bloqueia se a contagem de testes falhando (fora dos flaky) é MAIOR
 *      que a do baseline;
 *   3. NÃO bloqueia se for menor — baseline encolhe, isso é progresso;
 *   4. avisa (sem bloquear) se algum arquivo do baseline parou de falhar,
 *      porque o baseline ficou velho;
 *   5. falha fechada: baseline ausente/ilegível/JSON inválido, relatório do
 *      vitest ausente ou não interpretável, ou contagem inconsistente → BLOQUEIA.
 *
 * Ponto 5 é deliberado e é o oposto do que `isDemoExportBlocked()` faz
 * (src/shared/lib/demoExportGuard.ts:34 devolve `false` incondicional, ou
 * seja, falha aberta). Aqui, "não consegui verificar" é sempre "não passa".
 *
 * Uso:
 *   node scripts/push-gate.mjs [relatorio.json] [baseline.json]
 *   node scripts/push-gate.mjs [relatorio.json] [baseline.json] --write
 *
 * Variáveis de ambiente (só mudam CAMINHOS; nenhuma pula o gate):
 *   PUSH_GATE_REPORT    caminho do relatório JSON do vitest
 *   PUSH_GATE_BASELINE  caminho do baseline
 *
 * Saída: exit 0 = passou (com avisos), exit 1 = bloqueou.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_BASELINE = join(
  ROOT,
  "scripts",
  "push-gate-baseline.json",
);
export const DEFAULT_REPORT = join(
  ROOT,
  "node_modules",
  ".cache",
  "push-gate",
  "vitest.json",
);

/** Erro de gate = "não consegui interpretar" = fail-closed. Sempre bloqueia. */
export class GateError extends Error {}

function readJson(path, what) {
  if (!existsSync(path)) {
    throw new GateError(`${what} não encontrado: ${path}`);
  }
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    throw new GateError(`${what} ilegível (${path}): ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new GateError(`${what} tem JSON inválido (${path}): ${err.message}`);
  }
}

/** Valida a forma do baseline. Qualquer campo faltando ou torto bloqueia. */
export function validateBaseline(baseline) {
  const errs = [];
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) {
    return ["baseline não é um objeto JSON"];
  }
  const isStrArray = (v) =>
    Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0);

  if (!isStrArray(baseline.failingTestFiles)) {
    errs.push(
      "`failingTestFiles` ausente, não é array ou tem entrada não-string",
    );
  }
  if (
    baseline.flakyTestFiles !== undefined &&
    !isStrArray(baseline.flakyTestFiles)
  ) {
    errs.push("`flakyTestFiles` não é array de strings");
  }
  if (
    !Number.isInteger(baseline.failingTestCount) ||
    baseline.failingTestCount < 0
  ) {
    errs.push("`failingTestCount` ausente, não é inteiro, ou é negativo");
  }
  const stableOk = isStrArray(baseline.failingTestFiles);
  const flakyOk =
    baseline.flakyTestFiles === undefined ||
    isStrArray(baseline.flakyTestFiles);
  // Só compara duplicatas se as listas são listas: espalhar uma string com
  // [...str] devolve as letras e acusaria "repetido" num baseline já inválido
  // por outro motivo, poluindo a mensagem com um erro que não é o real.
  if (stableOk && flakyOk) {
    const dupes = [
      ...baseline.failingTestFiles,
      ...(baseline.flakyTestFiles ?? []),
    ];
    if (new Set(dupes).size !== dupes.length) {
      errs.push(
        "há arquivo repetido entre `failingTestFiles` e `flakyTestFiles`",
      );
    }
  }
  return errs;
}

/** Extrai {arquivo -> testes falhando} do relatório JSON do vitest. */
export function parseReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new GateError("relatório do vitest não é um objeto JSON");
  }
  if (!Array.isArray(report.testResults)) {
    throw new GateError(
      "relatório do vitest sem `testResults` — o reporter não é o esperado (--reporter=json)",
    );
  }
  if (!Number.isInteger(report.numFailedTests)) {
    throw new GateError("relatório do vitest sem `numFailedTests` inteiro");
  }

  const files = new Map();
  for (const suite of report.testResults) {
    if (!suite || typeof suite.name !== "string") {
      throw new GateError("entrada de testResults sem `name`");
    }
    const rel = relative(ROOT, suite.name) || suite.name;
    const assertions = Array.isArray(suite.assertionResults)
      ? suite.assertionResults
      : [];
    const failed = assertions.filter((a) => a && a.status === "failed").length;
    // `status !== "passed"` cobre erro de suíte (sem assert falho): um arquivo
    // que nem está no baseline é bloqueio, que é o resultado fail-closed certo.
    if (suite.status === "passed" && failed === 0) continue;
    files.set(rel, (files.get(rel) ?? 0) + failed);
  }

  // Duas contagens do mesmo reporter discordando = relatório que não deu para
  // interpretar com confiança. Bloqueia em vez de escolher a que "parece" certa.
  const summed = [...files.values()].reduce((a, b) => a + b, 0);
  if (summed !== report.numFailedTests) {
    throw new GateError(
      `relatório do vitest inconsistente: numFailedTests=${report.numFailedTests} ` +
        `mas a soma por arquivo dá ${summed}`,
    );
  }
  return { files, totalFailed: report.numFailedTests };
}

/**
 * Regra de comparação. `observed` vem de parseReport(); retorna a decisão e os
 * dados para a mensagem — a mensagem é parte do contrato, não enfeite.
 */
export function evaluateGate(baseline, observed) {
  // Revalida aqui também: evaluateGate é exportado e chamado direto pelos
  // testes. Sem isso, um baseline undefined chegaria num TypeError — que sai 1
  // por acidente, sem a mensagem que diz o que fazer.
  const baselineErrs = validateBaseline(baseline);
  if (baselineErrs.length) {
    throw new GateError(`baseline inválido: ${baselineErrs.join("; ")}`);
  }
  const known = new Set(baseline.failingTestFiles);
  const flaky = new Set(baseline.flakyTestFiles ?? []);
  const failingNow = [...observed.files.keys()].sort();

  const newFiles = failingNow.filter((f) => !known.has(f) && !flaky.has(f));
  // Contagem comparada exclui os flaky de propósito: eles oscilam por conta
  // própria e diluiriam o sinal de regressão com ruído que não é de ninguém.
  const observedStable = failingNow
    .filter((f) => !flaky.has(f))
    .reduce((a, f) => a + observed.files.get(f), 0);
  const stale = [...known].filter((f) => !observed.files.has(f)).sort();
  const flakyFailing = failingNow.filter((f) => flaky.has(f));
  const knownFailing = failingNow.filter((f) => known.has(f));

  return {
    block: newFiles.length > 0 || observedStable > baseline.failingTestCount,
    newFiles,
    stale,
    flakyFailing,
    flakyPassing: [...flaky].filter((f) => !observed.files.has(f)).sort(),
    knownFailing,
    failingNow,
    observedStable,
    observedTotal: observed.totalFailed,
    baselineCount: baseline.failingTestCount,
    baselineSha: baseline.recordedAgainst,
  };
}

export function formatVerdict(v) {
  const L = [];
  const sha = v.baselineSha
    ? String(v.baselineSha).slice(0, 8)
    : "desconhecido";
  L.push(
    `   ${v.failingNow.length} arquivo(s) falhando · ${v.knownFailing.length} no baseline · ` +
      `${v.observedTotal} teste(s) · estáveis ${v.observedStable}/${v.baselineCount} ` +
      `(baseline @ ${sha})`,
  );

  if (v.flakyFailing.length) {
    L.push(
      `   ℹ️  flaky conhecido falhando agora: ${v.flakyFailing.join(", ")}`,
    );
  }
  if (!v.block) {
    L.push("   ✅ Nenhuma regressão nova — gate de testes passou.");
  } else {
    L.push("   ❌ REGRESSÃO NOVA — bloqueando o push.");
    if (v.newFiles.length) {
      L.push("");
      L.push(`   Arquivo(s) falhando fora do baseline (${v.newFiles.length}):`);
      for (const f of v.newFiles) L.push(`     • ${f}`);
    }
    if (v.observedStable > v.baselineCount) {
      L.push("");
      L.push(
        `   Testes estáveis falhando subiram: ${v.observedStable} > baseline ${v.baselineCount}.`,
      );
    }
    L.push("");
    L.push(
      "   O gate bloqueia regressão NOVA, não o vermelho herdado. Para passar:",
    );
    L.push("     • corrija o que você introduziu, ou");
    L.push(
      "     • se o vermelho novo for legítimo e aceito, regenere o baseline:",
    );
    L.push(
      "         npm run test:run  # ou: node scripts/push-gate.mjs <relatorio.json> --write",
    );
    L.push(
      "       commite o baseline NO MESMO commit do teste — nunca sozinho;",
    );
    L.push(
      "     • ou, em emergência, SKIP_PUSH_GATE=1 (imprime aviso e fica registrado no CI).",
    );
  }

  if (v.stale.length) {
    L.push("");
    L.push(
      `   ⚠️  Baseline velho: ${v.stale.length} arquivo(s) do baseline passaram:`,
    );
    for (const f of v.stale) L.push(`     • ${f}`);
    L.push("     Regenere o baseline para não accumulate essa lista.");
  }
  return L.join("\n");
}

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

/** Regrava o baseline medindo o relatório. Preserva `notes` (atribuição humana). */
export function writeBaseline(baselinePath, observed, previous) {
  const files = [...observed.files.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const flakyFiles = files
    .filter(([f]) => previous?.flakyTestFiles?.includes(f))
    .map(([f]) => f);
  const stable = files.filter(([f]) => !flakyFiles.includes(f));

  const payload = {
    recordedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    recordedAgainst: gitSha(),
    failingTestCount: stable.reduce((a, [, n]) => a + n, 0),
    failingTestFiles: stable.map(([f]) => f),
    ...(flakyFiles.length ? { flakyTestFiles: flakyFiles } : {}),
    notes: previous?.notes ?? {
      method:
        "Regenerado por scripts/push-gate.mjs --write. Atribua cada arquivo à fatia que fecha.",
    },
  };
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

function main(argv) {
  const write = argv.includes("--write");
  const positional = argv.filter((a) => !a.startsWith("--"));
  const reportPath =
    process.env.PUSH_GATE_REPORT ?? positional[0] ?? DEFAULT_REPORT;
  const baselinePath =
    process.env.PUSH_GATE_BASELINE ?? positional[1] ?? DEFAULT_BASELINE;

  let previous;
  try {
    // Baseline ausente é erro, não "sem baseline": só `--write` pode criar um.
    // (Uma versão anterior desta linha só checava existsSync e caía num
    // TypeError em evaluateGate — saía 1 por acidente, com stack trace em vez
    // da mensagem. Falha-closed por sorte não é falha-closed.)
    if (write && !existsSync(baselinePath)) {
      previous = undefined;
    } else {
      previous = readJson(baselinePath, "baseline");
    }
    if (previous) {
      const errs = validateBaseline(previous);
      if (errs.length) {
        throw new GateError(
          `baseline inválido (${baselinePath}): ${errs.join("; ")}`,
        );
      }
    }
  } catch (err) {
    if (!(err instanceof GateError)) throw err;
    console.error(`\n❌ push-gate: ${err.message}`);
    console.error(
      "   Fail-closed: sem baseline legível não há como provar que não regrediu.\n",
    );
    process.exit(1);
  }

  let observed;
  try {
    observed = parseReport(readJson(reportPath, "relatório do vitest"));
  } catch (err) {
    if (!(err instanceof GateError)) throw err;
    console.error(`\n❌ push-gate: ${err.message}`);
    console.error(
      `   Fail-closed: sem relatório interpretável não há como provar que não regrediu.\n` +
        `   (esperado em ${reportPath})\n`,
    );
    process.exit(1);
  }

  if (write) {
    const payload = writeBaseline(baselinePath, observed, previous);
    console.error(
      `\n📝 Baseline regravado: ${baselinePath}\n` +
        `   ${payload.failingTestFiles.length} arquivo(s) estáveis, ` +
        `failingTestCount=${payload.failingTestCount}, recordedAgainst=${payload.recordedAgainst}\n` +
        `   ⚠️  Revise \`notes.slices\` — a atribuição por arquivo foi preservada, não gerada.\n`,
    );
    process.exit(0);
  }

  const verdict = evaluateGate(previous, observed);
  console.error(`🧪 push-gate (não piorou) — ${reportPath}`);
  console.error(formatVerdict(verdict));
  console.error("");
  process.exit(verdict.block ? 1 : 0);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
  main(process.argv.slice(2));
}
