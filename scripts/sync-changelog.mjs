#!/usr/bin/env node
/**
 * Deterministic in-app changelog sync.
 *
 * Parses the root CHANGELOG.md (offline, deterministic) and regenerates the
 * `changelog.versions` section of src/shared/i18n/locales/{pt-BR,en-US}.json.
 *
 * Merge semantics:
 * - Versions defined by CHANGELOG.md win: the app entry is regenerated from
 *   the markdown sections (per-locale section titles, raw item text).
 * - Versions present only in the locale files are preserved untouched (the
 *   rich handwritten entries for releases the root changelog does not cover,
 *   e.g. 1.9.1/1.7.0) so the in-app history is never gutted.
 * - Dates: inline `(YYYY-MM-DD)` in the version heading wins; otherwise the
 *   existing locale date is kept; otherwise empty.
 * - The final list is sorted by SemVer descending.
 *
 * Source of truth:
 * - Default: parse CHANGELOG.md (offline, deterministic — used by CI).
 * - `--from-github [vX.Y.Z]`: fetch the audited catalog from release-notes.mjs
 *   via the GitHub API (fallback when CHANGELOG.md misses a release).
 *
 * Flags:
 *   --dry-run   print per-locale version diff, write nothing (default)
 *   --write     update changelog.versions in both locale files
 *   --check     exit 1 if the locales are out of sync with the source
 *
 * Only `changelog.versions` is touched; every other JSON key is preserved
 * byte-for-byte (same 2-space indentation, key order, trailing newline).
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LOCALE_NAMES = ["pt-BR", "en-US"];
const DEFAULT_REPOSITORY = "ils15/open3dcalc";
/** File basename → SECTION_TITLES key. */
const LOCALE_KEYS = Object.freeze({ "pt-BR": "pt", "en-US": "en" });

// Lazy: under vitest's module runner import.meta.url is not a file:// URL.
const repoRoot = () => {
  const url = String(import.meta.url);
  return url.startsWith("file:")
    ? fileURLToPath(new URL("..", url))
    : process.cwd();
};

const VERSION_HEADING = /^##\s+v(\d+\.\d+\.\d+)(.*)$/;
const DATE_INLINE = /\((\d{4}-\d{2}-\d{2})\)/;
const SECTION_HEADING = /^###\s+(.+)$/;
const ITEM_LINE = /^[-*]\s+(.+)$/;
const MARKDOWN_LINK = /\[([^\]]*)\]\([^)]*\)/g;
const HTML_TAG = /<[^>]+>/g;
const EMOJI = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;
const LEADING_EMOJI = /^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const RELEASE_TAG = /^v\d+\.\d+\.\d+$/;

/**
 * CHANGELOG.md headings (emoji-stripped, lowercased) and release-notes.mjs
 * category names both funnel into these canonical keys.
 */
export const CATEGORY_KEYS = Object.freeze({
  enhancements: "features",
  features: "features",
  "bug fixes": "fixes",
  fixes: "fixes",
  chore: "other",
  "other changes": "other",
  other: "other",
  ci: "ci",
  "ci/cd": "ci",
  documentation: "documentation",
  contributors: "contributors",
  "breaking changes": "breaking",
  security: "security",
  dependencies: "dependencies",
  "performance improvements": "improvements",
  improvements: "improvements",
  refactors: "other",
  styles: "other",
  builds: "other",
});

/** Per-locale section titles for the canonical category keys. */
export const SECTION_TITLES = Object.freeze({
  en: Object.freeze({
    features: "🚀 Features",
    improvements: "🚀 Enhancements",
    fixes: "🐛 Fixes",
    other: "🧹 Other",
    ci: "🤖 CI",
    documentation: "📖 Documentation",
    contributors: "❤️ Contributors",
    breaking: "💥 Breaking Changes",
    security: "🔒 Security",
    dependencies: "⬆️ Dependencies",
  }),
  pt: Object.freeze({
    features: "🚀 Novidades",
    improvements: "🚀 Melhorias",
    fixes: "🐛 Correções",
    other: "🧹 Outros",
    ci: "🤖 CI/CD",
    documentation: "📖 Documentação",
    contributors: "❤️ Contribuidores",
    breaking: "💥 Mudanças Quebradas",
    security: "🔒 Segurança",
    dependencies: "⬆️ Dependências",
  }),
});

/** Strip markdown links, HTML and emoji; keep `**bold**` and `` `code` ``. */
export const cleanItem = (text) =>
  String(text ?? "")
    .replace(MARKDOWN_LINK, "$1")
    .replace(HTML_TAG, "")
    .replace(EMOJI, "")
    .replace(/\s+/g, " ")
    .trim();

export const parseSemver = (value) => {
  const match = SEMVER.exec(String(value ?? ""));
  return match
    ? {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
      }
    : { major: 0, minor: 0, patch: 0 };
};

export const semverDesc = (a, b) => {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  return pb.major - pa.major || pb.minor - pa.minor || pb.patch - pa.patch;
};

export const emojiStrip = (text) =>
  String(text ?? "")
    .replace(LEADING_EMOJI, "")
    .trim();

export const categoryKeyFor = (heading) => {
  const key = emojiStrip(heading).toLowerCase();
  return CATEGORY_KEYS[key] ?? null;
};

export const sectionTitleFor = (locale, heading) => {
  const key = categoryKeyFor(heading);
  return key ? SECTION_TITLES[locale][key] : String(heading).trim();
};

/**
 * Parse `## vX.Y.Z` sections from markdown into
 * `{ version, date, sections: [{ raw, items }] }` entries.
 * Version headings may carry an inline `(YYYY-MM-DD)` date; dates default to
 * empty. Loose text (compare links, `---`, footer prose) is ignored.
 */
export function parseChangelog(markdown) {
  const entries = [];
  let entry = null;
  let section = null;
  for (const rawLine of String(markdown).split(/\r?\n/)) {
    const versionHeading = VERSION_HEADING.exec(rawLine);
    if (versionHeading) {
      const [, version, rest] = versionHeading;
      const inlineDate = DATE_INLINE.exec(rest);
      entry = { version, date: inlineDate?.[1] ?? "", sections: [] };
      section = null;
      entries.push(entry);
      continue;
    }
    if (!entry) continue; // prose before the first version heading
    const sectionHeading = SECTION_HEADING.exec(rawLine);
    if (sectionHeading) {
      section = { raw: sectionHeading[1].trim(), items: [] };
      entry.sections.push(section);
      continue;
    }
    const itemLine = ITEM_LINE.exec(rawLine);
    if (itemLine && section) section.items.push(cleanItem(itemLine[1].trim()));
  }
  return entries;
}

/** Map parsed sections to per-locale titles, merging duplicates by title. */
export function localizeSections(locale, sections) {
  const merged = [];
  const byTitle = new Map();
  for (const section of sections) {
    const title = sectionTitleFor(locale, section.raw);
    if (!byTitle.has(title)) {
      const localized = { title, items: [] };
      byTitle.set(title, localized);
      merged.push(localized);
    }
    byTitle.get(title).items.push(...section.items);
  }
  return merged;
}

/**
 * CHANGELOG.md wins for the versions it defines; locale-only versions are
 * preserved. Missing dates fall back to the existing locale entry date.
 */
export function mergeEntries(parsed, existing) {
  const existingByVersion = new Map(
    existing.map((entry) => [entry.version, entry]),
  );
  const merged = parsed.map((entry) => {
    const old = existingByVersion.get(entry.version);
    return old && !entry.date ? { ...entry, date: old.date ?? "" } : entry;
  });
  const parsedVersions = new Set(parsed.map((entry) => entry.version));
  for (const entry of existing)
    if (!parsedVersions.has(entry.version)) merged.push(entry);
  merged.sort((a, b) => semverDesc(a.version, b.version));
  return merged;
}

export function buildVersions(locale, parsed, existing) {
  const localized = parsed.map((entry) => ({
    version: entry.version,
    date: entry.date,
    sections: localizeSections(locale, entry.sections),
  }));
  return mergeEntries(localized, existing);
}

export function diffVersions(before, after) {
  const added = after
    .filter((entry) => !before.some((old) => old.version === entry.version))
    .map((entry) => entry.version);
  const removed = before
    .filter((old) => !after.some((entry) => entry.version === old.version))
    .map((old) => old.version);
  const changed = after
    .filter((entry) => {
      const old = before.find(
        (candidate) => candidate.version === entry.version,
      );
      return old && JSON.stringify(old) !== JSON.stringify(entry);
    })
    .map((entry) => entry.version);
  return {
    added,
    removed,
    changed,
    before: before.length,
    after: after.length,
  };
}

export function formatReport(name, report) {
  const lines = [
    `${name}.json: ${report.before} → ${report.after} version entries`,
  ];
  for (const version of report.added) lines.push(`  + ${version}`);
  for (const version of report.removed) lines.push(`  - ${version}`);
  for (const version of report.changed) lines.push(`  ~ ${version} (updated)`);
  return lines.join("\n");
}

/**
 * Locate the `"versions": [...]` array span in the raw locale JSON. The
 * changelog section uses 2-space indentation while other sections use mixed
 * tabs/spaces, so the array is spliced surgically to preserve every other
 * byte (JSON.stringify would normalize unrelated formatting).
 */
export function findVersionsArraySpan(raw) {
  const keyIndex = raw.indexOf('"versions":');
  if (keyIndex < 0) return null;
  const open = raw.indexOf("[", keyIndex);
  if (open < 0) return null;
  let depth = 0;
  let inString = false;
  for (let index = open; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (char === "\\") index += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "[") depth += 1;
    else if (char === "]") {
      depth -= 1;
      if (depth === 0) return { start: open, end: index + 1 };
    }
  }
  return null;
}

/** Serialize the versions array at the changelog section's nesting depth. */
export const serializeVersionsBlock = (versions) =>
  JSON.stringify(versions, null, 2)
    .split("\n")
    .map((line, index) => (index === 0 ? line : `    ${line}`))
    .join("\n");

/** Replace only the `"versions": [...]` span; every other byte is kept. */
export function replaceVersionsArray(raw, versions) {
  const span = findVersionsArraySpan(raw);
  if (!span)
    throw new Error(
      "changelog.versions array not found; refusing to rewrite the locale",
    );
  return `${raw.slice(0, span.start)}${serializeVersionsBlock(versions)}${raw.slice(span.end)}`;
}

function entryFromCatalog(catalog) {
  const release = catalog.releases?.[0];
  const version = String(release?.tag ?? "").replace(/^v/, "");
  const sections = [];
  const byCategory = new Map();
  for (const item of catalog.items ?? []) {
    const raw = item.category ?? "Other Changes";
    if (!byCategory.has(raw)) {
      byCategory.set(raw, { raw, items: [] });
      sections.push(byCategory.get(raw));
    }
    byCategory.get(raw).items.push(cleanItem(item.title ?? ""));
  }
  return { version, date: "", sections };
}

/** Fallback source: audited per-release catalogs from release-notes.mjs. */
async function entriesFromGitHub(repository, tag) {
  const { collect } = await import("./release-notes.mjs");
  if (tag) return [entryFromCatalog(await collect(repository, tag))];
  const catalog = await collect(repository);
  const tags = catalog.releases
    .map((release) => release.tag)
    .filter((candidate) => RELEASE_TAG.test(candidate))
    .sort((a, b) => semverDesc(a.replace("v", ""), b.replace("v", "")));
  const entries = [];
  for (const releaseTag of tags)
    entries.push(entryFromCatalog(await collect(repository, releaseTag)));
  return entries;
}

const usage = [
  "Usage: node scripts/sync-changelog.mjs [--dry-run|--write|--check]",
  "                                    [--from-github [vX.Y.Z]]",
  "  default mode: --dry-run (show what would change, write nothing)",
  "  --dry-run       print per-locale version diff without writing",
  "  --write         update changelog.versions in both locale files",
  "  --check         exit 1 when the locales are out of sync with the source",
  "  --from-github   use release-notes.mjs (GitHub API) instead of CHANGELOG.md",
  "                  as the source; optionally scope to one vX.Y.Z release",
].join("\n");

export function parseArgs(argv) {
  const modes = new Set(["--dry-run", "--write", "--check"]);
  const modeFlags = argv.filter((arg) => modes.has(arg));
  if (modeFlags.length > 1)
    throw new Error(`Conflicting modes: ${modeFlags.join(" and ")}\n${usage}`);
  let fromGithub = false;
  let githubTag = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (modes.has(arg)) continue;
    if (arg === "--from-github") {
      fromGithub = true;
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        if (!RELEASE_TAG.test(next))
          throw new Error(`Invalid release tag: ${next}\n${usage}`);
        githubTag = next;
        index += 1;
      }
      continue;
    }
    throw new Error(`Unknown flag: ${arg}\n${usage}`);
  }
  return {
    mode: modeFlags[0] ?? "--dry-run",
    fromGithub,
    githubTag,
  };
}

export async function main(argv = process.argv.slice(2), overrides = {}) {
  const options = parseArgs(argv);
  const root = overrides.root ?? repoRoot();
  const changelogPath = overrides.changelog ?? resolve(root, "CHANGELOG.md");
  const localesDir =
    overrides.localesDir ?? resolve(root, "src/shared/i18n/locales");
  const repository = process.env.GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY;
  const parsed = options.fromGithub
    ? await entriesFromGitHub(repository, options.githubTag)
    : parseChangelog(await readFile(changelogPath, "utf8"));

  const reports = {};
  for (const name of LOCALE_NAMES) {
    const filePath = resolve(localesDir, `${name}.json`);
    const raw = await readFile(filePath, "utf8");
    const data = JSON.parse(raw);
    if (!data.changelog) data.changelog = {};
    const existing = Array.isArray(data.changelog.versions)
      ? data.changelog.versions
      : [];
    const versions = buildVersions(LOCALE_KEYS[name], parsed, existing);
    reports[name] = diffVersions(existing, versions);
    if (options.mode === "--write") {
      // Surgical splice keeps every byte outside changelog.versions intact.
      await writeFile(filePath, replaceVersionsArray(raw, versions), "utf8");
    }
  }

  const stale = Object.entries(reports).filter(
    ([, report]) =>
      report.added.length || report.removed.length || report.changed.length,
  );
  if (options.mode === "--check") {
    if (stale.length)
      throw new Error(
        stale
          .map(
            ([name, report]) =>
              `${name}.json is out of sync with the changelog source\n${formatReport(name, report)}`,
          )
          .join("\n"),
      );
    return { mode: options.mode, reports, ok: true };
  }
  if (stale.length) {
    for (const [name, report] of stale) console.log(formatReport(name, report));
  } else if (options.mode === "--dry-run") {
    console.log("Locales are already in sync; nothing to write.");
  }
  return {
    mode: options.mode,
    reports,
    wrote: options.mode === "--write" && stale.length > 0,
  };
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
