/**
 * @vitest-environment node
 *
 * Contract tests for scripts/push-gate.mjs — the pre-push test gate that blocks
 * only NEW regressions against scripts/push-gate-baseline.json.
 *
 * The point of these tests is rule 5 (fail-closed). A gate that silently passes
 * when it cannot parse its inputs is worse than no gate: it reports "green" for
 * a check that never ran. Every malformed-input case below must throw GateError,
 * never return a passing verdict.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  evaluateGate,
  parseReport,
  validateBaseline,
  GateError,
} from "../push-gate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

const KNOWN_A = "src/shared/__tests__/layoutShell.test.ts";
const KNOWN_B = "src/platform/web/App.focusMode.test.tsx";
const FLAKY =
  "src/shared/components/Catalog/__tests__/ProductInventory.test.tsx";
const NEW = "src/shared/components/Nope/__tests__/brandNew.test.tsx";

function baseline(over = {}) {
  return {
    recordedAt: "2026-10-03T12:27:31Z",
    recordedAgainst: "09d8947e686a6e13f89f6a744ec681db6f487aa7",
    failingTestCount: 7,
    failingTestFiles: [KNOWN_A, KNOWN_B],
    flakyTestFiles: [FLAKY],
    notes: {},
    ...over,
  };
}

/** observed no formato de parseReport(): { files: Map, totalFailed } */
function observed(entries) {
  const files = new Map(entries);
  return { files, totalFailed: [...files.values()].reduce((a, b) => a + b, 0) };
}

describe("evaluateGate — decisão", () => {
  it("bloqueia quando um arquivo fora do baseline falha", () => {
    const v = evaluateGate(
      baseline(),
      observed([
        [KNOWN_A, 7],
        [NEW, 1],
      ]),
    );
    expect(v.block).toBe(true);
    expect(v.newFiles).toEqual([NEW]);
  });

  it("bloqueia quando a contagem estável sobe sem arquivo novo", () => {
    const v = evaluateGate(baseline(), observed([[KNOWN_A, 8]]));
    expect(v.block).toBe(true);
    expect(v.newFiles).toEqual([]);
    expect(v.observedStable).toBe(8);
  });

  it("NÃO bloqueia quando a contagem é menor — baseline encolhe", () => {
    const v = evaluateGate(baseline(), observed([[KNOWN_A, 3]]));
    expect(v.block).toBe(false);
    expect(v.observedStable).toBe(3);
  });

  it("avisa, sem bloquear, quando um arquivo do baseline para de falhar", () => {
    const v = evaluateGate(baseline(), observed([[KNOWN_A, 7]]));
    expect(v.block).toBe(false);
    expect(v.stale).toEqual([KNOWN_B]);
  });

  it("arquivo flaky não abre buraco na contagem", () => {
    // O flaky falha: a contagem estável ignora o contribution dele.
    const v = evaluateGate(
      baseline(),
      observed([
        [KNOWN_A, 7],
        [FLAKY, 1],
      ]),
    );
    expect(v.block).toBe(false);
    expect(v.observedStable).toBe(7);
    expect(v.observedTotal).toBe(8);
    expect(v.flakyFailing).toEqual([FLAKY]);
  });

  it("arquivo flaky passando não é tratado como baseline velho", () => {
    const v = evaluateGate(
      baseline(),
      observed([
        [KNOWN_A, 7],
        [KNOWN_B, 0],
      ]),
    );
    expect(v.flakyPassing).toEqual([FLAKY]);
    expect(v.stale).not.toContain(FLAKY);
  });

  it("suíte que falha sem assert (erro de suíte) fora do baseline bloqueia", () => {
    // parsed como Map com 0 asserts falhos — ainda é um arquivo novo.
    const v = evaluateGate(baseline(), observed([[NEW, 0]]));
    expect(v.block).toBe(true);
    expect(v.newFiles).toEqual([NEW]);
  });
});

describe("evaluateGate — fail-closed (regra 5)", () => {
  it("lança GateError com baseline undefined em vez de TypeError", () => {
    expect(() => evaluateGate(undefined, observed([]))).toThrow(GateError);
  });

  it("lança GateError com baseline malformado", () => {
    expect(() =>
      evaluateGate({ failingTestFiles: "nope" }, observed([])),
    ).toThrow(GateError);
    expect(() => evaluateGate({ failingTestFiles: [] }, observed([]))).toThrow(
      GateError,
    );
  });

  it("lança GateError quando o mesmo arquivo está nos dois listas", () => {
    expect(
      validateBaseline(baseline({ flakyTestFiles: [KNOWN_A] })).length,
    ).toBeGreaterThan(0);
  });
});

describe("parseReport — relatório do vitest", () => {
  // parseReport devolve caminhos relativos à raiz do repo, como o vitest emite.
  const suite = (rel, status, failed) => ({
    name: join(ROOT, rel),
    status,
    assertionResults: Array.from({ length: failed }, () => ({
      status: "failed",
    })),
  });

  it("extrai só as suítes que não passaram", () => {
    const r = parseReport({
      numFailedTests: 3,
      testResults: [
        suite("a.test.ts", "passed", 0),
        suite("b.test.ts", "failed", 2),
        suite("c.test.ts", "failed", 1),
      ],
    });
    expect([...r.files.entries()]).toEqual([
      ["b.test.ts", 2],
      ["c.test.ts", 1],
    ]);
    expect(r.totalFailed).toBe(3);
  });

  it("lança GateError sem testResults", () => {
    expect(() => parseReport({ numFailedTests: 0 })).toThrow(GateError);
  });

  it("lança GateError sem numFailedTests inteiro", () => {
    expect(() => parseReport({ testResults: [] })).toThrow(GateError);
  });

  it("lança GateError quando as duas contagens do reporter discordam", () => {
    expect(() =>
      parseReport({
        numFailedTests: 99,
        testResults: [suite("a.test.ts", "failed", 1)],
      }),
    ).toThrow(GateError);
  });

  it("lança GateError com entrada de suíte sem name", () => {
    expect(() =>
      parseReport({ numFailedTests: 0, testResults: [{ status: "failed" }] }),
    ).toThrow(GateError);
  });
});

describe("validateBaseline", () => {
  it("aceita o baseline real do repo", () => {
    const real = JSON.parse(
      readFileSync(join(HERE, "..", "push-gate-baseline.json"), "utf8"),
    );
    expect(validateBaseline(real)).toEqual([]);
    // Todo arquivo listado tem uma fatia atribuída — é o que impede o baseline
    // de virar lixo acumulado.
    for (const f of real.failingTestFiles) {
      expect(real.notes.slices[f], `sem nota de slice para ${f}`).toBeTruthy();
    }
  });
});
