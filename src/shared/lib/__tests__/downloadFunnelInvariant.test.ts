import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

import { exportData } from "@/shared/lib/dataSync";

// ── Invariante de funil único ─────────────────────────────────────────────
// `downloadBlob` é o ÚNICO lugar do app onde um Blob vira arquivo no disco.
// Qualquer outro `URL.createObjectURL` é um funil paralelo que burla o guard
// de demo por construção. Este teste pega a regressão "alguém criou um funil
// novo" no momento em que ela entra no codebase — não depende de o caminho
// estar coberto por um teste comportamental.

const SOURCE_ROOT = join(process.cwd(), "src");

/** Caminha src/ e devolve todo .ts/.tsx de produção (sem testes). */
function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...listSourceFiles(full));
      continue;
    }
    const ext = extname(entry);
    if ((ext === ".ts" || ext === ".tsx") && !entry.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

describe("invariante de funil único", () => {
  it("URL.createObjectURL só aparece no choke point downloadBlob", () => {
    const offenders = listSourceFiles(SOURCE_ROOT)
      .filter((file) => readFileSync(file, "utf8").includes("createObjectURL"))
      .map((file) => relative(SOURCE_ROOT, file));

    expect(offenders).toEqual(["shared/lib/download.ts"]);
  });
});

// ── Comportamental: o funil do sync está guardado ─────────────────────────
// O antigo triggerDownload() fazia Blob→URL→click próprio; agora roteia por
// downloadBlob, que recusa em demo. Confirma o fix no caminho específico.

interface MockDemoModeState {
  isActive: boolean;
  enter: () => void;
  exit: () => void;
}

const mockState: MockDemoModeState = {
  isActive: false,
  enter: vi.fn(),
  exit: vi.fn(),
};

function mockDemoModeStore(): MockDemoModeState;
function mockDemoModeStore<T>(selector: (state: MockDemoModeState) => T): T;
function mockDemoModeStore(
  selector?: (state: MockDemoModeState) => unknown,
): unknown {
  return selector ? selector(mockState) : mockState;
}

vi.mock("@/shared/stores/demoModeStore", () => ({
  useDemoModeStore: Object.assign(mockDemoModeStore, {
    getState: () => mockState,
  }),
}));

describe("dataSync export funnel", () => {
  let createObjectURL: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    createObjectURL = vi.spyOn(URL, "createObjectURL");
  });

  afterEach(() => {
    createObjectURL.mockRestore();
    mockState.isActive = false;
  });

  it("recusa a exportação em demo — nenhum Blob vira URL", async () => {
    mockState.isActive = true;

    const result = await exportData({ password: "senha-forte" });

    // O guard aborta antes de qualquer createObjectURL: nada chega ao disco.
    expect(createObjectURL).not.toHaveBeenCalled();
    // A UI ainda recebe metadados do bundle (o envelope é construído), mas o
    // download em si não ocorre.
    expect(result.fileName).toMatch(/open3dcalc-sync-/);
  });

  it("exporta normalmente fora do demo — comportamento inalterado", async () => {
    mockState.isActive = false;

    await exportData({ password: "senha-forte" });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});
