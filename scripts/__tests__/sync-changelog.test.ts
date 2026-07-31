import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildVersions,
  cleanItem,
  findVersionsArraySpan,
  formatReport,
  main,
  parseArgs,
  parseChangelog,
  replaceVersionsArray,
  sectionTitleFor,
  semverDesc,
} from "../sync-changelog.mjs";

const FIXTURES = resolve("scripts/__fixtures__/changelog");
const fixtureChangelog = () =>
  readFile(resolve(FIXTURES, "CHANGELOG.md"), "utf8");
const fixtureLocale = async (name) =>
  JSON.parse(await readFile(resolve(FIXTURES, `${name}.json`), "utf8"));

/** Materialize a temporary repo root mirroring the fixture layout. */
const tempRoot = async (changelogOverrides = "") => {
  const root = await mkdtemp(resolve(tmpdir(), "sync-changelog-"));
  const changelog = changelogOverrides || (await fixtureChangelog());
  await writeFile(resolve(root, "CHANGELOG.md"), changelog);
  const locales = resolve(root, "src/shared/i18n/locales");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(locales, { recursive: true });
  await writeFile(
    resolve(locales, "pt-BR.json"),
    JSON.stringify(await fixtureLocale("pt-BR"), null, 2),
  );
  await writeFile(
    resolve(locales, "en-US.json"),
    JSON.stringify(await fixtureLocale("en-US"), null, 2),
  );
  return root;
};

describe("sync-changelog parsing", () => {
  it("parses versions, inline dates and section categories from markdown", async () => {
    const entries = parseChangelog(await fixtureChangelog());
    expect(entries.map((entry) => entry.version)).toEqual([
      "1.2.0",
      "1.1.1",
      "1.1.0",
    ]);
    expect(entries.map((entry) => entry.date)).toEqual(["", "", "2026-05-20"]);
    const v120 = entries[0];
    expect(v120.sections.map((section) => section.raw)).toEqual([
      "🚀 Enhancements",
      "🩹 Bug Fixes",
      "🏡 Chore",
      "🤖 CI",
      "❤️ Contributors",
    ]);
    // Empty releases (only a compare link) yield an entry with no sections.
    expect(entries[1].sections).toEqual([]);
    // Custom headings (v1.1.0) are kept raw, emoji included.
    expect(entries[2].sections.map((section) => section.raw)).toEqual([
      "🎨 UI/UX",
      "🔧 Técnico",
      "✅ Testes",
    ]);
  });

  it("cleans items: strips markdown links and emoji, keeps **bold** and `code`", () => {
    expect(
      cleanItem("**ui:** Add dark mode ([abc123](https://example.com/abc123))"),
    ).toBe("**ui:** Add dark mode (abc123)");
    expect(
      cleanItem("Ship release automation ([#12](https://example.com/pull/12))"),
    ).toBe("Ship release automation (#12)");
    expect(
      cleanItem("Monorepo unificado (`src/shared/` + `src/platform/`)"),
    ).toBe("Monorepo unificado (`src/shared/` + `src/platform/`)");
    expect(cleanItem("🚀 emoji leading item")).toBe("emoji leading item");
    expect(cleanItem("  extra   whitespace  ")).toBe("extra whitespace");
  });

  it("classifies changelogen headings into canonical per-locale titles", () => {
    expect(sectionTitleFor("pt", "🚀 Enhancements")).toBe("🚀 Novidades");
    expect(sectionTitleFor("pt", "🩹 Bug Fixes")).toBe("🐛 Correções");
    expect(sectionTitleFor("pt", "🏡 Chore")).toBe("🧹 Outros");
    expect(sectionTitleFor("pt", "🤖 CI")).toBe("🤖 CI/CD");
    expect(sectionTitleFor("pt", "📖 Documentation")).toBe("📖 Documentação");
    expect(sectionTitleFor("pt", "❤️ Contributors")).toBe("❤️ Contribuidores");
    expect(sectionTitleFor("en", "🚀 Enhancements")).toBe("🚀 Features");
    expect(sectionTitleFor("en", "🩹 Bug Fixes")).toBe("🐛 Fixes");
    expect(sectionTitleFor("en", "🏡 Chore")).toBe("🧹 Other");
    expect(sectionTitleFor("en", "🤖 CI")).toBe("🤖 CI");
    // Unmapped headings keep their original text.
    expect(sectionTitleFor("en", "🎨 UI/UX")).toBe("🎨 UI/UX");
    expect(sectionTitleFor("pt", "🔧 Técnico")).toBe("🔧 Técnico");
  });
});

describe("sync-changelog generation", () => {
  it("merges md-wins entries with preserved locale-only versions, semver desc", async () => {
    const parsed = parseChangelog(await fixtureChangelog());
    const existing = (await fixtureLocale("pt-BR")).changelog.versions;
    const versions = buildVersions("pt", parsed, existing);
    expect(versions.map((entry) => entry.version)).toEqual([
      "1.2.0",
      "1.1.1",
      "1.1.0",
      "1.0.0",
    ]);
    // CHANGELOG.md wins for 1.2.0 (replaces the handwritten 🧪 Testes entry)…
    const v120 = versions[0];
    expect(v120.date).toBe("2026-05-25"); // …but keeps the existing date.
    expect(v120.sections.map((section) => section.title)).toEqual([
      "🚀 Novidades",
      "🐛 Correções",
      "🧹 Outros",
      "🤖 CI/CD",
      "❤️ Contribuidores",
    ]);
    expect(v120.sections[0].items).toEqual([
      "**ui:** Add dark mode (abc123)",
      "**ci:** Ship release automation (#12)",
    ]);
    // Locale-only versions are preserved untouched.
    expect(versions[3]).toEqual(existing[1]);
  });

  it("generates per-locale section titles with shared raw item text", async () => {
    const parsed = parseChangelog(await fixtureChangelog());
    const pt = buildVersions("pt", parsed, []);
    const en = buildVersions("en", parsed, []);
    const ptV120 = pt[0];
    const enV120 = en[0];
    expect(ptV120.sections.map((section) => section.title)).toEqual([
      "🚀 Novidades",
      "🐛 Correções",
      "🧹 Outros",
      "🤖 CI/CD",
      "❤️ Contribuidores",
    ]);
    expect(enV120.sections.map((section) => section.title)).toEqual([
      "🚀 Features",
      "🐛 Fixes",
      "🧹 Other",
      "🤖 CI",
      "❤️ Contributors",
    ]);
    // Items are the raw markdown text, identical across locales.
    expect(ptV120.sections[0].items).toEqual(enV120.sections[0].items);
    // Custom v1.1.0 headings stay raw in both locales; inline date preserved.
    const ptV110 = pt.find((entry) => entry.version === "1.1.0");
    expect(ptV110.date).toBe("2026-05-20");
    expect(ptV110.sections.map((section) => section.title)).toEqual([
      "🎨 UI/UX",
      "🔧 Técnico",
      "✅ Testes",
    ]);
  });

  it("sorts merged versions by semver descending", () => {
    expect(semverDesc("1.9.2", "1.9.1")).toBeLessThan(0);
    expect(semverDesc("1.9.1", "1.9.2")).toBeGreaterThan(0);
    expect(semverDesc("1.9.2", "1.10.0")).toBeGreaterThan(0);
    expect(semverDesc("1.9.2", "1.9.2")).toBe(0);
  });

  it("is idempotent", async () => {
    const parsed = parseChangelog(await fixtureChangelog());
    const existing = (await fixtureLocale("en-US")).changelog.versions;
    const once = buildVersions("en", parsed, existing);
    const twice = buildVersions("en", parsed, once);
    expect(twice).toEqual(once);
  });
});

describe("sync-changelog CLI", () => {
  it("parses flags and rejects conflicting or unknown ones", () => {
    expect(parseArgs([])).toEqual({
      mode: "--dry-run",
      fromGithub: false,
      githubTag: null,
    });
    expect(parseArgs(["--write"])).toMatchObject({ mode: "--write" });
    expect(parseArgs(["--check"])).toMatchObject({ mode: "--check" });
    expect(parseArgs(["--from-github", "v1.9.2"])).toMatchObject({
      fromGithub: true,
      githubTag: "v1.9.2",
    });
    expect(parseArgs(["--from-github", "--write"])).toMatchObject({
      fromGithub: true,
      githubTag: null,
      mode: "--write",
    });
    expect(() => parseArgs(["--write", "--check"])).toThrow("Conflicting");
    expect(() => parseArgs(["--from-github", "banana"])).toThrow(
      "Invalid release tag",
    );
    expect(() => parseArgs(["--bogus"])).toThrow("Unknown flag");
  });

  it("writes only changelog.versions and preserves every other JSON key", async () => {
    const root = await tempRoot();
    const before = await fixtureLocale("pt-BR");
    await main(["--write"], { root });
    const written = JSON.parse(
      await readFile(
        resolve(root, "src/shared/i18n/locales/pt-BR.json"),
        "utf8",
      ),
    );
    expect(written.common).toEqual(before.common);
    expect(written.nav).toEqual(before.nav);
    expect(written.changelog.header).toBe(before.changelog.header);
    expect(written.changelog.versions.map((entry) => entry.version)).toEqual([
      "1.2.0",
      "1.1.1",
      "1.1.0",
      "1.0.0",
    ]);
  });

  it("is file-level idempotent: a second --write changes nothing", async () => {
    const root = await tempRoot();
    await main(["--write"], { root });
    const first = await readFile(
      resolve(root, "src/shared/i18n/locales/en-US.json"),
      "utf8",
    );
    const report = await main(["--write"], { root });
    expect(report.wrote).toBe(false);
    const second = await readFile(
      resolve(root, "src/shared/i18n/locales/en-US.json"),
      "utf8",
    );
    expect(second).toBe(first);
  });

  it("--check passes when in sync and fails when the locale diverges", async () => {
    const root = await tempRoot();
    await main(["--write"], { root });
    await expect(main(["--check"], { root })).resolves.toMatchObject({
      ok: true,
    });

    // Divergence: drop an item from the synced pt-BR 1.2.0 entry.
    const ptPath = resolve(root, "src/shared/i18n/locales/pt-BR.json");
    const diverged = JSON.parse(await readFile(ptPath, "utf8"));
    diverged.changelog.versions[0].sections[0].items.pop();
    await writeFile(ptPath, `${JSON.stringify(diverged, null, 2)}\n`);
    await expect(main(["--check"], { root })).rejects.toThrow("out of sync");
    // A --dry-run reports the stale locale without writing.
    const report = await main(["--dry-run"], { root });
    expect(report.reports["pt-BR"].changed).toContain("1.2.0");
    expect(await readFile(ptPath, "utf8")).toContain("dark mode");
  });

  it("reports additions, removals and updates per locale", async () => {
    const report = formatReport("pt-BR", {
      added: ["1.2.0"],
      removed: ["1.0.0"],
      changed: ["1.1.0"],
      before: 2,
      after: 3,
    });
    expect(report).toContain("pt-BR.json: 2 → 3 version entries");
    expect(report).toContain("+ 1.2.0");
    expect(report).toContain("- 1.0.0");
    expect(report).toContain("~ 1.1.0 (updated)");
  });

  it("--check detects additions from the changelog source", async () => {
    const root = await tempRoot();
    // The fixture locale already lacks 1.1.1 and 1.1.0 entries.
    await expect(main(["--check"], { root })).rejects.toThrow("out of sync");
  });

  it("surgically replaces only the versions array span", () => {
    const raw = [
      "{",
      '  "changelog": {',
      '    "header": "x",',
      '    "versions": [',
      '      { "version": "1.0.0", "date": "", "sections": [] }',
      "    ],",
      '    "viewAllOnGitHub": "y"',
      "  },",
      '\t"legacy": "\tindented with a literal tab"',
      "}",
    ].join("\n");
    const next = [{ version: "2.0.0", date: "", sections: [] }];
    const updated = replaceVersionsArray(raw, next);
    expect(updated).toBe([
      "{",
      '  "changelog": {',
      '    "header": "x",',
      '    "versions": [',
      "      {",
      '        "version": "2.0.0",',
      '        "date": "",',
      '        "sections": []',
      "      }",
      "    ],",
      '    "viewAllOnGitHub": "y"',
      "  },",
      '\t"legacy": "\tindented with a literal tab"',
      "}",
    ].join("\n"));
    const span = findVersionsArraySpan(raw);
    expect(span).not.toBeNull();
    expect(raw.slice(span.start, span.start + 1)).toBe("[");
    expect(raw.slice(span.end - 1, span.end)).toBe("]");
  });

  it("preserves non-changelog bytes exactly (mixed indentation)", async () => {
    const root = await tempRoot();
    const ptPath = resolve(root, "src/shared/i18n/locales/pt-BR.json");
    const raw = await readFile(ptPath, "utf8");
    // The repo's real locales mix tabs and spaces outside changelog.versions.
    const withTab = raw.replace(
      '"appName": "Open3DCalc"',
      '\t"appName": "Open3DCalc"',
    );
    await writeFile(ptPath, withTab);
    await main(["--write"], { root });
    const after = await readFile(ptPath, "utf8");
    // The tab-indented key outside the changelog section is byte-identical.
    expect(after).toContain('\t"appName": "Open3DCalc"');
    // Everything before "versions" and after its closing bracket is untouched.
    const versionsSpan = findVersionsArraySpan(after);
    const beforeSpan = findVersionsArraySpan(withTab);
    expect(after.slice(0, versionsSpan.start)).toBe(
      withTab.slice(0, beforeSpan.start),
    );
    expect(after.slice(versionsSpan.end)).toBe(withTab.slice(beforeSpan.end));
  });
});

describe("sync-changelog release workflow", () => {
  it("keeps the release workflow in sync with the in-app changelog", async () => {
    const workflow = await readFile(
      resolve(".github/workflows/release.yml"),
      "utf8",
    );
    const allowed = workflow.match(/ALLOWED=\$'([^']+)'/)?.[1] ?? "";
    expect(allowed).toContain("src/shared/i18n/locales/pt-BR.json");
    expect(allowed).toContain("src/shared/i18n/locales/en-US.json");
    const syncIndex = workflow.indexOf("Sync in-app changelog");
    const commitIndex = workflow.indexOf("Commit and push release branch");
    expect(syncIndex).toBeGreaterThan(-1);
    expect(commitIndex).toBeGreaterThan(syncIndex);
    expect(workflow).toContain("node scripts/sync-changelog.mjs --write");
    expect(workflow).toContain(
      "git add package.json package-lock.json CHANGELOG.md",
    );
    expect(workflow).toContain(
      "src/shared/i18n/locales/pt-BR.json src/shared/i18n/locales/en-US.json",
    );
  });
});
