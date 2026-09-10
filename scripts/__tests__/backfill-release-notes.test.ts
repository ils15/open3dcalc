import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertSafeGhCommand,
  bodySha256,
  diffLines,
  formatDiff,
  main,
  normalizeBody,
  parseArgs,
} from "../backfill-release-notes.mjs";

const REPO = "ils15/open3dcalc";

const canonicalBody = (tag) =>
  [
    "## What's Changed",
    "",
    "### 🚀 Features",
    "",
    `- feat: thing for ${tag} ([#1](https://github.com/${REPO}/pull/1))`,
    "",
    "### ❤️ Contributors",
    "",
    "@alice",
    "",
    `**Full Changelog**: https://github.com/${REPO}/compare/v1.0.0...${tag}`,
    "",
  ].join("\n");

const oldBody = (tag) =>
  [`## ${tag}`, "", "- legacy hand-written note", ""].join("\n");

/** Build a hermetic fake GitHub/gh environment. */
const harness = async (initial: Record<string, string>) => {
  const store = new Map(Object.entries(initial));
  const ghCalls: string[][] = [];
  const snapshotDir = await mkdtemp(resolve(tmpdir(), "backfill-snap-"));
  const runGh = vi.fn(async (args: string[]) => {
    ghCalls.push(args);
    if (args[0] === "release" && args[1] === "edit") {
      const tag = args[2];
      const at = args.indexOf("--notes-file");
      store.set(tag, await readFile(args[at + 1], "utf8"));
    }
    return "";
  });
  const deps = {
    listReleases: async () =>
      [...store.entries()].map(([tag, body]) => ({ tag, body })),
    renderBody: async (_repository: string, tag: string) => canonicalBody(tag),
    runGh,
    snapshotDir,
    now: () => "2026-09-10T00:00:00.000Z",
  };
  return { deps, ghCalls, runGh, snapshotDir, store };
};

describe("parseArgs", () => {
  it("parses --dry-run --all and --apply --release", () => {
    expect(parseArgs(["--dry-run", "--all"])).toMatchObject({
      mode: "dry-run",
      all: true,
    });
    expect(parseArgs(["--apply", "--release", "v1.11.0"])).toMatchObject({
      mode: "apply",
      release: "v1.11.0",
    });
  });

  it("parses restore with and without an explicit snapshot path", () => {
    expect(parseArgs(["--restore", "v1.11.0"])).toMatchObject({
      mode: "restore",
      restore: "v1.11.0",
      snapshotPath: undefined,
    });
    expect(
      parseArgs(["--restore", "v1.11.0", "--from-snapshot", "/tmp/s.json"]),
    ).toMatchObject({
      mode: "restore",
      restore: "v1.11.0",
      snapshotPath: resolve("/tmp/s.json"),
    });
    // --from-snapshot with no value falls back to the default location.
    expect(
      parseArgs(["--restore", "v1.11.0", "--from-snapshot"]),
    ).toMatchObject({
      mode: "restore",
      snapshotPath: undefined,
    });
  });

  it("rejects unknown flags, missing scope, and conflicting modes", () => {
    expect(() => parseArgs(["--nope", "--all"])).toThrow("Unknown flag");
    expect(() => parseArgs(["--dry-run"])).toThrow("required");
    expect(() => parseArgs(["--dry-run", "--apply", "--all"])).toThrow(
      "either --dry-run or --apply",
    );
    expect(() =>
      parseArgs(["--dry-run", "--all", "--release", "v1.0.0"]),
    ).toThrow("either --all or --release");
    expect(() => parseArgs(["--apply", "--release", "1.0.0"])).toThrow(
      "vX.Y.Z",
    );
    expect(() => parseArgs(["--restore", "v1.0.0", "--apply"])).toThrow(
      "restore",
    );
  });
});

describe("body hashing, normalization and diff", () => {
  it("hashes equivalent bodies identically regardless of trailing newlines", () => {
    const body = canonicalBody("v1.1.0");
    expect(bodySha256(body)).toBe(bodySha256(`${body}\n\n  `));
    expect(normalizeBody("a\r\nb\r\n")).toBe("a\nb");
  });

  it("produces an add/remove/context line diff", () => {
    const entries = diffLines("a\nb\nc", "a\nB\nc");
    expect(entries).toEqual([
      { type: "context", text: "a" },
      { type: "remove", text: "b" },
      { type: "add", text: "B" },
      { type: "context", text: "c" },
    ]);
    expect(formatDiff(entries)).toBe("  a\n- b\n+ B\n  c");
  });
});

describe("assertSafeGhCommand", () => {
  it("allows release edit and api, blocks destructive/latest operations", () => {
    expect(() =>
      assertSafeGhCommand(["release", "edit", "v1.0.0", "--notes-file", "x"]),
    ).not.toThrow();
    expect(() =>
      assertSafeGhCommand(["api", "repos/o/r/releases"]),
    ).not.toThrow();
    for (const args of [
      ["release", "delete", "v1.0.0"],
      ["release", "upload", "v1.0.0", "a.zip"],
      ["release", "download", "v1.0.0"],
      ["release", "edit", "v1.0.0", "--target", "main"],
      ["api", "repos/o/r/releases/latest"],
    ])
      expect(() => assertSafeGhCommand(args)).toThrow();
  });
});

describe("main --dry-run", () => {
  it("never mutates: no gh call, no snapshot, but reports hashes and diff", async () => {
    const { deps, ghCalls, snapshotDir } = await harness({
      "v1.10.0": oldBody("v1.10.0"),
      "v1.11.0": oldBody("v1.11.0"),
    });
    const result = await main(["--dry-run", "--all"], deps);
    expect(result.mode).toBe("dry-run");
    expect(result.results).toHaveLength(2);
    expect(ghCalls).toHaveLength(0);
    for (const entry of result.results) {
      expect(entry.changed).toBe(true);
      expect(entry.currentSha256).not.toBe(entry.canonicalSha256);
      expect(entry.canonical).toContain("## What's Changed");
      expect(entry.diff.some((line) => line.type === "add")).toBe(true);
    }
    await expect(
      readFile(resolve(snapshotDir, "v1.11.0.json")),
    ).rejects.toThrow();
  });

  it("scopes a single release with --release and marks it unchanged when identical", async () => {
    const same = canonicalBody("v1.11.0");
    const { deps, ghCalls } = await harness({
      "v1.10.0": oldBody("v1.10.0"),
      "v1.11.0": same,
    });
    const result = await main(["--dry-run", "--release", "v1.11.0"], deps);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].changed).toBe(false);
    expect(ghCalls).toHaveLength(0);
  });

  it("throws when --release points to an unknown tag", async () => {
    const { deps } = await harness({ "v1.11.0": oldBody("v1.11.0") });
    await expect(
      main(["--dry-run", "--release", "v9.9.9"], deps),
    ).rejects.toThrow("not found");
  });
});

describe("main --apply", () => {
  it("snapshots the previous body and edits the release with the canonical body", async () => {
    const { deps, ghCalls, runGh, snapshotDir } = await harness({
      "v1.11.0": oldBody("v1.11.0"),
    });
    const result = await main(["--apply", "--release", "v1.11.0"], deps);
    expect(result.results[0].action).toBe("applied");
    expect(runGh).toHaveBeenCalledTimes(1);
    expect(ghCalls[0]).toEqual([
      "release",
      "edit",
      "v1.11.0",
      "--notes-file",
      expect.any(String),
      "--title",
      "Open3DCalc v1.11.0",
    ]);
    const snapshot = JSON.parse(
      await readFile(resolve(snapshotDir, "v1.11.0.json"), "utf8"),
    );
    expect(snapshot).toMatchObject({
      tag: "v1.11.0",
      previousBody: oldBody("v1.11.0"),
      newBody: canonicalBody("v1.11.0"),
      sha256: bodySha256(canonicalBody("v1.11.0")),
      timestamp: "2026-09-10T00:00:00.000Z",
    });
    expect(result.results[0].snapshot).toBe(
      resolve(snapshotDir, "v1.11.0.json"),
    );
  });

  it("is idempotent: a second apply is a no-op and writes no new snapshot", async () => {
    const { deps, runGh, snapshotDir, store } = await harness({
      "v1.10.0": oldBody("v1.10.0"),
      "v1.11.0": oldBody("v1.11.0"),
    });
    const first = await main(["--apply", "--all"], deps);
    expect(first.results.every((entry) => entry.action === "applied")).toBe(
      true,
    );
    expect(runGh).toHaveBeenCalledTimes(2);
    // gh call mutated only the stored bodies, never tags/assets/latest.
    expect(store.get("v1.11.0")).toBe(canonicalBody("v1.11.0"));

    const second = await main(["--apply", "--all"], deps);
    expect(second.results.every((entry) => entry.action === "skipped")).toBe(
      true,
    );
    expect(runGh).toHaveBeenCalledTimes(2);
    // The skipped release keeps the snapshot from the first run.
    const snapshot = JSON.parse(
      await readFile(resolve(snapshotDir, "v1.10.0.json"), "utf8"),
    );
    expect(snapshot.previousBody).toBe(oldBody("v1.10.0"));
  });

  it("reports but never applies a degenerate canonical body", async () => {
    const { deps, runGh } = await harness({ "v1.11.0": oldBody("v1.11.0") });
    const degraded = {
      ...deps,
      renderBody: async () =>
        "## What's Changed\n\n**Full Changelog**: https://github.com/ils15/open3dcalc/commits/v1.11.0\n",
    };
    const result = await main(["--apply", "--release", "v1.11.0"], degraded);
    expect(result.results[0]).toMatchObject({
      renderable: false,
      action: "skipped-unsafe",
    });
    expect(result.results[0].error).toContain("degenerate");
    expect(runGh).not.toHaveBeenCalled();
  });

  it("skips an unsafe release in --all but still applies the safe ones", async () => {
    const { deps, runGh, store } = await harness({
      "v1.10.0": oldBody("v1.10.0"),
      "v1.11.0": oldBody("v1.11.0"),
    });
    const mixed = {
      ...deps,
      renderBody: async (_repository: string, tag: string) =>
        tag === "v1.10.0"
          ? "## What's Changed\n\n**Full Changelog**: https://x\n"
          : canonicalBody(tag),
    };
    const result = await main(["--apply", "--all"], mixed);
    expect(result.results.map((entry) => entry.action)).toEqual([
      "skipped-unsafe",
      "applied",
    ]);
    expect(runGh).toHaveBeenCalledTimes(1);
    expect(store.get("v1.10.0")).toBe(oldBody("v1.10.0"));
    expect(store.get("v1.11.0")).toBe(canonicalBody("v1.11.0"));
  });
});

describe("main --restore", () => {
  it("restores the previous body from the default snapshot path", async () => {
    const { deps, runGh, snapshotDir, store } = await harness({
      "v1.11.0": oldBody("v1.11.0"),
    });
    await mkdir(snapshotDir, { recursive: true });
    await writeFile(
      resolve(snapshotDir, "v1.11.0.json"),
      JSON.stringify({
        tag: "v1.11.0",
        previousBody: oldBody("v1.11.0"),
        newBody: canonicalBody("v1.11.0"),
        sha256: "x",
        timestamp: "t",
      }),
      "utf8",
    );
    store.set("v1.11.0", canonicalBody("v1.11.0"));
    const result = await main(["--restore", "v1.11.0"], deps);
    expect(result).toMatchObject({
      mode: "restore",
      tag: "v1.11.0",
      snapshot: resolve(snapshotDir, "v1.11.0.json"),
    });
    expect(runGh).toHaveBeenCalledTimes(1);
    const args = runGh.mock.calls[0][0];
    expect(args.slice(0, 3)).toEqual(["release", "edit", "v1.11.0"]);
    expect(args).not.toContain("--title");
    expect(store.get("v1.11.0")).toBe(oldBody("v1.11.0"));
  });

  it("honors an explicit --from-snapshot path", async () => {
    const { deps, runGh, store } = await harness({
      "v1.11.0": canonicalBody("v1.11.0"),
    });
    const dir = await mkdtemp(resolve(tmpdir(), "backfill-explicit-"));
    const custom = resolve(dir, "custom.json");
    await writeFile(
      custom,
      JSON.stringify({ previousBody: oldBody("v1.11.0") }),
      "utf8",
    );
    await main(["--restore", "v1.11.0", "--from-snapshot", custom], deps);
    expect(runGh).toHaveBeenCalledTimes(1);
    expect(store.get("v1.11.0")).toBe(oldBody("v1.11.0"));
  });
});
