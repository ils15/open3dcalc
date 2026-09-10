import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { main, normalize, renderPublication } from "../release-notes.mjs";

const REPO = "ils15/open3dcalc";

// Synthetic catalog exercising every canonical section, a commit-only item,
// a duplicated contributor, a bot, and an author-less item.
const catalog = () =>
  normalize({
    pullRequests: [
      {
        number: 10,
        title: "feat: add gizmo",
        merged: true,
        user: { login: "alice" },
      },
      {
        number: 11,
        title: "fix: crash on load",
        merged: true,
        user: { login: "bob" },
      },
      {
        number: 12,
        title: "deps: bump vite",
        merged: true,
        user: { login: "carol" },
      },
      {
        number: 13,
        title: "ci: add workflow",
        merged: true,
        user: { login: "alice" },
      },
    ],
    commits: [
      {
        sha: "aaa1111bbbb",
        commit: { message: "chore: tidy scripts" },
        author: { login: "dave" },
      },
      {
        sha: "bbb2222cccc",
        commit: { message: "refactor: split module" },
        author: { login: "dave" },
      },
      {
        sha: "ccc3333dddd",
        commit: { message: "docs: update readme" },
        author: { login: "erin" },
      },
      {
        sha: "ddd4444eeee",
        commit: { message: "security: harden input" },
        author: { login: "frank" },
      },
      {
        sha: "eee5555ffff",
        commit: { message: "feat!: breaking api" },
        author: { login: "grace" },
      },
      {
        sha: "fff6666aaaa",
        commit: { message: "chore: bot noise" },
        author: { login: "github-actions[bot]" },
      },
    ],
  });

describe("renderPublication", () => {
  it("renders the canonical wrapper with emoji sections in fixed order", () => {
    const markdown = renderPublication(catalog(), REPO, {
      tag: "v1.1.0",
      previousTag: "v1.0.0",
    });
    expect(markdown.split("\n")[0]).toBe("## What's Changed");
    expect(markdown).toContain("### 🚀 Features");
    expect(markdown).toContain("### 🐛 Fixes");
    expect(markdown).toContain("### 🧹 Chores");
    expect(markdown).toContain("### 📦 Dependencies");
    expect(markdown).toContain("### 🤖 CI/CD");
    expect(markdown).toContain("### 📚 Documentation");
    expect(markdown).toContain("### 🔒 Security");
    expect(markdown).toContain("### ⚠️ Breaking Changes");
    expect(markdown).toContain("### ❤️ Contributors");
    const headings = markdown
      .split("\n")
      .filter((line) => line.startsWith("### "))
      .map((line) => line.slice(4));
    expect(headings).toEqual([
      "🚀 Features",
      "🐛 Fixes",
      "🧹 Chores",
      "📦 Dependencies",
      "🤖 CI/CD",
      "📚 Documentation",
      "🔒 Security",
      "⚠️ Breaking Changes",
      "❤️ Contributors",
    ]);
  });

  it("renders PR links and commit shas in the canonical item format", () => {
    const markdown = renderPublication(catalog(), REPO, {
      tag: "v1.1.0",
      previousTag: "v1.0.0",
    });
    expect(markdown).toContain(
      "- feat: add gizmo ([#10](https://github.com/ils15/open3dcalc/pull/10))",
    );
    expect(markdown).toContain(
      "- deps: bump vite ([#12](https://github.com/ils15/open3dcalc/pull/12))",
    );
    expect(markdown).toContain("- chore: tidy scripts (commit aaa1111)");
    expect(markdown).toContain("- docs: update readme (commit ccc3333)");
  });

  it("maps refactor/style/chore into the single Chores section, sorted by title", () => {
    const markdown = renderPublication(catalog(), REPO, {
      tag: "v1.1.0",
      previousTag: "v1.0.0",
    });
    const chores = markdown
      .split("### 🧹 Chores\n")[1]
      .split("\n\n")[0]
      .split("\n")
      .filter((line) => line.startsWith("- "));
    expect(chores).toEqual([
      "- chore: bot noise (commit fff6666)",
      "- chore: tidy scripts (commit aaa1111)",
      "- refactor: split module (commit bbb2222)",
    ]);
  });

  it("omits empty sections and the Contributors section when there is no human", () => {
    const markdown = renderPublication(
      normalize({
        commits: [
          {
            sha: "abc1234def",
            commit: { message: "feat: solo" },
            author: { login: "github-actions[bot]" },
          },
        ],
      }),
      REPO,
      { tag: "v1.0.0" },
    );
    expect(markdown).toContain("### 🚀 Features");
    expect(markdown).not.toContain("### 🐛 Fixes");
    expect(markdown).not.toContain("### 🧹 Chores");
    expect(markdown).not.toContain("### ❤️ Contributors");
  });

  it("lists deduplicated human contributors without bots or Unknown", () => {
    const markdown = renderPublication(catalog(), REPO, {
      tag: "v1.1.0",
      previousTag: "v1.0.0",
    });
    const contributors = markdown
      .split("### ❤️ Contributors\n")[1]
      .split("\n\n")[0]
      .split("\n")
      .filter(Boolean);
    expect(contributors).toEqual([
      "@alice",
      "@bob",
      "@carol",
      "@dave",
      "@erin",
      "@frank",
      "@grace",
    ]);
    expect(markdown).not.toContain("@github-actions");
    expect(markdown).not.toContain("@Unknown");
  });

  it("renders the bold Full Changelog line with the compare range", () => {
    const markdown = renderPublication(catalog(), REPO, {
      tag: "v1.1.0",
      previousTag: "v1.0.0",
    });
    expect(markdown).toContain(
      "**Full Changelog**: https://github.com/ils15/open3dcalc/compare/v1.0.0...v1.1.0",
    );
    // A bold line, never a heading.
    expect(markdown.split("\n")).toContain(
      "**Full Changelog**: https://github.com/ils15/open3dcalc/compare/v1.0.0...v1.1.0",
    );
  });

  it("falls back to the commits URL for the first release", () => {
    const markdown = renderPublication(catalog(), REPO, { tag: "v1.0.0" });
    expect(markdown).toContain(
      "**Full Changelog**: https://github.com/ils15/open3dcalc/commits/v1.0.0",
    );
  });

  it("escapes hostile titles and the repository path", () => {
    const markdown = renderPublication(
      normalize({
        pullRequests: [
          {
            number: 9,
            title: "fix: escape [bracket] (paren) *star*",
            merged: true,
            user: { login: "alice" },
          },
        ],
      }),
      "ils15/open3dcalc)",
      { tag: "v1.0.0" },
    );
    expect(markdown).toContain("\\[bracket\\]");
    expect(markdown).toContain("\\*star\\*");
    expect(markdown).toContain("https://github.com/ils15/open3dcalc\\)/pull/9");
  });

  it("is byte-identical across re-runs and never emits Downloads/Checksums", () => {
    const first = renderPublication(catalog(), REPO, {
      tag: "v1.1.0",
      previousTag: "v1.0.0",
    });
    const second = renderPublication(catalog(), REPO, {
      tag: "v1.1.0",
      previousTag: "v1.0.0",
    });
    expect(first).toBe(second);
    expect(first).not.toContain("Downloads");
    expect(first).not.toContain("Checksums");
  });

  it("keeps inline parentheses, plus and hash unescaped in item titles", () => {
    const markdown = renderPublication(
      normalize({
        pullRequests: [
          {
            number: 87,
            title:
              "feat(calc): preço de venda editável + ponte calculadora→produto (closes #85)",
            merged: true,
            user: { login: "alice" },
          },
        ],
      }),
      REPO,
      { tag: "v1.1.0", previousTag: "v1.0.0" },
    );
    expect(markdown).toContain(
      "- feat(calc): preço de venda editável + ponte calculadora→produto (closes #85) ([#87](https://github.com/ils15/open3dcalc/pull/87))",
    );
    expect(markdown).not.toContain("\\(");
    expect(markdown).not.toContain("\\)");
    expect(markdown).not.toContain("\\+");
    expect(markdown).not.toContain("\\#");
  });

  it("neutralizes HTML in item titles without escaping the whole subject", () => {
    const markdown = renderPublication(
      normalize({
        commits: [
          {
            sha: "abc1234def",
            commit: { message: "docs: safe text <script>alert(1)</script>" },
            author: { login: "dave" },
          },
        ],
      }),
      REPO,
      { tag: "v1.0.0" },
    );
    expect(markdown).not.toContain("<script>");
    expect(markdown).toContain("safe text");
  });

  it("uses only the bounded first line of a commit-only message", () => {
    const subject = `chore(deps): batch update 34 dependencies Major bumps: ${"a".repeat(140)}`;
    const markdown = renderPublication(
      normalize({
        commits: [
          {
            sha: "f467375abc",
            commit: {
              message: `${subject}\n\n## Body\nmore detail that must never leak`,
            },
            author: { login: "dave" },
          },
        ],
      }),
      REPO,
      { tag: "v1.0.0" },
    );
    const item = markdown.split("\n").find((line) => line.startsWith("- "));
    expect(item).toBe(`- ${subject.slice(0, 100)} (commit f467375)`);
    expect(markdown).not.toContain("more detail");
    expect(markdown).not.toContain("## Body");
  });
});

describe("main --notes-file", () => {
  it("writes the canonical publication body and keeps the audit artifacts", async () => {
    const output = await mkdtemp(resolve(tmpdir(), "release-publication-"));
    const notesFile = resolve(output, "publication.md");
    const audit = await main([
      "--all",
      "--input",
      "scripts/__fixtures__/release-notes/aggregate.json",
      "--output",
      output,
      "--notes-file",
      notesFile,
    ]);
    expect(audit.release).toBe("all");
    const publication = await readFile(notesFile, "utf8");
    expect(publication.split("\n")[0]).toBe("## What's Changed");
    expect(publication).toContain("**Full Changelog**:");
    // Audit artifacts stay untouched.
    await expect(
      readFile(resolve(output, "audit.json"), "utf8"),
    ).resolves.toContain('"partial": false');
    await expect(
      readFile(resolve(output, "release-notes-publication.md"), "utf8"),
    ).resolves.toContain("## What's Changed");
  });

  it("rejects an unknown flag and a value-less --notes-file", async () => {
    await expect(main(["--all", "--notes-file"])).rejects.toThrow(
      "requires a value",
    );
    await expect(main(["--all", "--nope"])).rejects.toThrow("Unknown flag");
  });
});
