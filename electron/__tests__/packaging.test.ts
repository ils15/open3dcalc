/**
 * @vitest-environment node
 *
 * Static packaging contract for the Windows release + auto-update feed.
 *
 * Regression guard for v1.10.0: the GitHub Release shipped with zero assets
 * (no Windows .exe) and auto-update failed with "arquivo não encontrado"
 * because `build.publish` had no GitHub provider, so electron-builder never
 * generated the app-update.yml / latest.yml feed consumed by electron-updater.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pkg = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf-8"),
) as {
  build: {
    publish?: unknown;
    win?: { target?: unknown; artifactName?: string };
    asarUnpack?: string[];
  };
};
const build = pkg.build;

describe("windows packaging + auto-update feed", () => {
  it("configura provider github para gerar app-update.yml/latest.yml", () => {
    const providers = (
      Array.isArray(build.publish) ? build.publish : [build.publish]
    ) as Array<
      { provider?: string; owner?: string; repo?: string } | undefined
    >;
    const github = providers.find((p) => p?.provider === "github");
    expect(github, "build.publish precisa de provider github").toBeDefined();
    expect(`${github?.owner}/${github?.repo}`).toBe("ils15/open3dcalc");
  });

  it("gera instalador NSIS x64 com artifactName versionado", () => {
    expect(build.win?.target).toEqual([{ target: "nsis", arch: ["x64"] }]);
    expect(build.win?.artifactName).toContain("${version}");
    expect(build.win?.artifactName).toContain(".${ext}");
  });

  it("desempacota better-sqlite3 do asar (módulo nativo)", () => {
    expect(build.asarUnpack?.some((p) => p.includes("better-sqlite3"))).toBe(
      true,
    );
  });
});
