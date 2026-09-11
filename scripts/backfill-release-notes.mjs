#!/usr/bin/env node
/**
 * Idempotent backfill and rollback for canonical GitHub release bodies.
 *
 * SAFETY CONTRACT
 * - `--dry-run` never mutates anything (no gh call, no snapshot).
 * - `--apply` snapshots the previous body before editing, and skips a release
 *   whose current body already hashes to the canonical render (idempotent).
 * - This tool only ever calls `gh release edit` and `gh api` (list releases).
 *   It NEVER touches tags, assets, or `latest`/`latest.yml`; destructive
 *   commands are rejected by `assertSafeGhCommand()`.
 * - `--restore` replays the body captured in a snapshot through
 *   `gh release edit <tag> --notes-file <file>`.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { collect, renderPublication } from "./release-notes.mjs";

const execFileAsync = promisify(execFile);

const VERSION = /^v\d+\.\d+\.\d+$/;
const USAGE =
  "Usage: node scripts/backfill-release-notes.mjs (--dry-run | --apply) (--all | --release vX.Y.Z) | --restore vX.Y.Z [--from-snapshot [path]]";

/** Collapse CRLF and trailing whitespace so equivalent bodies hash equally. */
export const normalizeBody = (text) =>
  String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\s+$/, "");

export const bodySha256 = (text) =>
  createHash("sha256").update(normalizeBody(text)).digest("hex");

/**
 * Minimal deterministic line diff (LCS backtracking).
 *
 * @returns {{ type: "context" | "add" | "remove", text: string }[]}
 */
export const diffLines = (before, after) => {
  const a = normalizeBody(before).split("\n");
  const b = normalizeBody(after).split("\n");
  const rows = a.length;
  const cols = b.length;
  const lcs = Array.from({ length: rows + 1 }, () => new Uint32Array(cols + 1));
  for (let i = rows - 1; i >= 0; i--)
    for (let j = cols - 1; j >= 0; j--)
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const entries = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (a[i] === b[j]) {
      entries.push({ type: "context", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      entries.push({ type: "remove", text: a[i] });
      i++;
    } else {
      entries.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < rows) entries.push({ type: "remove", text: a[i++] });
  while (j < cols) entries.push({ type: "add", text: b[j++] });
  return entries;
};

export const formatDiff = (entries) =>
  entries
    .map(
      (entry) =>
        `${entry.type === "add" ? "+" : entry.type === "remove" ? "-" : " "} ${entry.text}`,
    )
    .join("\n");

const FORBIDDEN_TOKENS = new Set([
  "--target",
  "--tag",
  "--latest",
  "--prerelease",
  "--draft",
  "delete",
  "upload",
  "download",
  "create",
]);

/**
 * Reject any gh invocation that could touch tags, assets, or `latest`.
 *
 * @param {string[]} args
 */
export const assertSafeGhCommand = (args) => {
  const list = Array.isArray(args) ? args.map(String) : [];
  const command = list[0];
  if (command !== "release" && command !== "api")
    throw new Error(`Refusing unsafe gh command: ${list.join(" ")}`);
  const subcommand = command === "release" ? list[1] : null;
  if (command === "release" && subcommand !== "edit")
    throw new Error(`Refusing unsafe gh release subcommand: ${list.join(" ")}`);
  const danger = list.find(
    (token) => FORBIDDEN_TOKENS.has(token) || /latest(\.yml)?/i.test(token),
  );
  if (danger)
    throw new Error(
      `Refusing to touch tags/assets/latest (${danger}): ${list.join(" ")}`,
    );
};

/**
 * @param {string[]} argv
 * @returns {{ mode: "dry-run" | "apply", all: boolean, release?: string }
 *   | { mode: "restore", restore: string, snapshotPath?: string }}
 */
export const parseArgs = (argv) => {
  const allowed = new Set([
    "--dry-run",
    "--apply",
    "--all",
    "--release",
    "--restore",
    "--from-snapshot",
  ]);
  for (const arg of argv)
    if (arg.startsWith("--") && !allowed.has(arg))
      throw new Error(`Unknown flag: ${arg}\n${USAGE}`);
  const value = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  const all = argv.includes("--all");
  const release = value("--release");
  const restore = value("--restore");
  const fromSnapshot = argv.includes("--from-snapshot");
  const snapshotValue = (() => {
    if (!fromSnapshot) return undefined;
    const index = argv.indexOf("--from-snapshot");
    const next = argv[index + 1];
    return next && !next.startsWith("--") ? next : undefined;
  })();

  if (
    release !== undefined &&
    (release.startsWith("--") || !VERSION.test(release))
  )
    throw new Error("--release must be a tag in vX.Y.Z format");
  if (
    restore !== undefined &&
    (restore.startsWith("--") || !VERSION.test(restore))
  )
    throw new Error("--restore must be a tag in vX.Y.Z format");
  if (fromSnapshot && restore === undefined)
    throw new Error(`--from-snapshot requires --restore\n${USAGE}`);

  if (restore !== undefined) {
    if (dryRun || apply || all || release !== undefined)
      throw new Error(
        `--restore cannot be combined with --dry-run/--apply/--all/--release\n${USAGE}`,
      );
    return {
      mode: "restore",
      restore,
      snapshotPath: snapshotValue ? resolve(snapshotValue) : undefined,
    };
  }

  if (!dryRun && !apply) throw new Error(`Use --dry-run or --apply\n${USAGE}`);
  if (dryRun && apply)
    throw new Error(`Use either --dry-run or --apply\n${USAGE}`);
  if (!all && release === undefined)
    throw new Error(`${USAGE}\nA release tag or --all is required.`);
  if (all && release !== undefined)
    throw new Error(`Use either --all or --release\n${USAGE}`);
  return { mode: dryRun ? "dry-run" : "apply", all, release };
};

const defaultRunGh = async (args) => {
  const { stdout } = await execFileAsync("gh", args, {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
};

const defaultListReleases = async (repository) => {
  const { stdout } = await execFileAsync(
    "gh",
    [
      "api",
      `repos/${repository}/releases?per_page=100`,
      "--paginate",
      "--jq",
      ".[] | {tag: .tag_name, body: .body}",
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line))
    .map((entry) => ({ tag: String(entry.tag ?? ""), body: entry.body ?? "" }));
};

const defaultRenderBody = async (repository, tag) => {
  const catalog = await collect(repository, tag);
  return renderPublication(catalog, repository, {
    tag,
    previousTag: catalog.range?.previous ?? null,
  });
};

const defaultWriteNotes = async (tag, body) => {
  const dir = await mkdtemp(resolve(tmpdir(), "release-notes-"));
  const file = resolve(dir, `${tag}.md`);
  await writeFile(file, body, "utf8");
  return file;
};

const createDefaultDeps = () => ({
  runGh: defaultRunGh,
  listReleases: defaultListReleases,
  renderBody: defaultRenderBody,
  writeNotes: defaultWriteNotes,
  now: () => new Date().toISOString(),
  snapshotDir: resolve("release-notes-snapshots"),
});

const writeSnapshot = async (snapshotDir, tag, snapshot) => {
  await mkdir(snapshotDir, { recursive: true });
  const file = resolve(snapshotDir, `${tag}.json`);
  await writeFile(file, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return file;
};

const PUBLICATION_ITEM = /^- /m;

/**
 * A canonical body with no bullet items means either the GitHub collection
 * degraded (rate limit / network) or the tag range legitimately has no
 * commits. Either way it must never overwrite an existing release body.
 */
const isRenderable = (body) => PUBLICATION_ITEM.test(body);

const selectReleases = async (options, repository, listReleases) => {
  const releases = (await listReleases(repository)).filter((release) =>
    VERSION.test(release.tag),
  );
  if (options.all)
    return releases.sort((a, b) =>
      a.tag.localeCompare(b.tag, "en", { numeric: true }),
    );
  const match = releases.find((release) => release.tag === options.release);
  if (!match)
    throw new Error(`Release ${options.release} not found in ${repository}`);
  return [match];
};

const restore = async (options, deps) => {
  const tag = options.restore;
  const snapshotPath =
    options.snapshotPath ?? resolve(deps.snapshotDir, `${tag}.json`);
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  const previous = snapshot?.previousBody;
  if (typeof previous !== "string")
    throw new Error(`Snapshot ${snapshotPath} has no previousBody`);
  const notesFile = await deps.writeNotes(tag, previous);
  const args = ["release", "edit", tag, "--notes-file", notesFile];
  assertSafeGhCommand(args);
  await deps.runGh(args);
  return { mode: "restore", tag, snapshot: snapshotPath };
};

const backfill = async (options, repository, deps) => {
  const releases = await selectReleases(options, repository, deps.listReleases);
  const results = [];
  for (const release of releases) {
    const canonical = await deps.renderBody(repository, release.tag);
    const current = release.body ?? "";
    const currentSha256 = bodySha256(current);
    const canonicalSha256 = bodySha256(canonical);
    const changed = currentSha256 !== canonicalSha256;
    const entry = {
      tag: release.tag,
      currentSha256,
      canonicalSha256,
      changed,
      canonical,
      diff: diffLines(current, canonical),
    };
    if (!isRenderable(canonical)) {
      // Never apply a degenerate body; report and keep going.
      results.push({
        ...entry,
        renderable: false,
        ...(options.mode === "apply" ? { action: "skipped-unsafe" } : {}),
        error: `degenerate canonical body for ${release.tag}; the release was left untouched`,
      });
      continue;
    }
    entry.renderable = true;
    if (options.mode === "dry-run") {
      results.push(entry);
      continue;
    }
    if (!changed) {
      results.push({ ...entry, action: "skipped" });
      continue;
    }
    const snapshot = await writeSnapshot(deps.snapshotDir, release.tag, {
      tag: release.tag,
      previousBody: current,
      newBody: canonical,
      sha256: canonicalSha256,
      timestamp: deps.now(),
    });
    const notesFile = await deps.writeNotes(release.tag, canonical);
    const args = [
      "release",
      "edit",
      release.tag,
      "--notes-file",
      notesFile,
      "--title",
      `Open3DCalc ${release.tag}`,
    ];
    assertSafeGhCommand(args);
    await deps.runGh(args);
    results.push({ ...entry, action: "applied", snapshot });
  }
  return { mode: options.mode, results };
};

/**
 * @param {string[]} [argv]
 * @param {object} [deps] Injectable dependencies (tests mock gh / the API).
 */
export async function main(argv = process.argv.slice(2), deps = {}) {
  const options = parseArgs(argv);
  const repository = process.env.GITHUB_REPOSITORY ?? "ils15/open3dcalc";
  const resolved = { ...createDefaultDeps(), ...deps };
  if (options.mode === "restore") return restore(options, resolved);
  return backfill(options, repository, resolved);
}

const printReport = (result) => {
  if (result.mode === "restore") {
    console.log(`Restored ${result.tag} from ${result.snapshot}`);
    return;
  }
  for (const entry of result.results) {
    console.log(`\n=== ${entry.tag} ===`);
    console.log(`current sha256:   ${entry.currentSha256}`);
    console.log(`canonical sha256: ${entry.canonicalSha256}`);
    console.log(`changed: ${entry.changed ? "yes" : "no"}`);
    if (entry.renderable === false) {
      console.log(`UNSAFE: ${entry.error}`);
      continue;
    }
    if ("action" in entry) {
      console.log(`action: ${entry.action}`);
      if (entry.snapshot) console.log(`snapshot: ${entry.snapshot}`);
    }
    if (result.mode === "dry-run") {
      console.log(formatDiff(entry.diff));
      console.log("----- canonical body -----");
      console.log(entry.canonical);
    }
  }
};

if (import.meta.url === `file://${process.argv[1]}`)
  main()
    .then(printReport)
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
