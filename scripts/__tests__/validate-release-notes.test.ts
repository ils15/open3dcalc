import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

// The default `--release` path shells out to `gh api`; stub it so the fetch
// branch is exercised deterministically without network access.
vi.mock("node:child_process", () => {
  const execFile = (
    _command: string,
    _args: string[],
    callback: (
      error: unknown,
      result: { stdout: string; stderr: string },
    ) => void,
  ) =>
    callback(null, {
      stdout: `## What's Changed\n\n### 🚀 Features\n- Add gizmo ([#10](https://github.com/ils15/open3dcalc/pull/10))\n\n**Full Changelog**: https://github.com/ils15/open3dcalc/compare/v1.0.0...v1.1.0\n`,
      stderr: "",
    });
  return { execFile, default: { execFile } };
});

import {
  main,
  parseArgs,
  validateReleaseNotes,
} from "../validate-release-notes.mjs";

const VALID = `## What's Changed

### 🚀 Features
- Add gizmo ([#10](https://github.com/ils15/open3dcalc/pull/10))

### 🐛 Fixes
- Fix crash on load (commit abc1234)

### ❤️ Contributors
@alice
@bob

**Full Changelog**: https://github.com/ils15/open3dcalc/compare/v1.0.0...v1.1.0
`;

describe("validateReleaseNotes", () => {
  it("accepts the canonical publication body", () => {
    expect(validateReleaseNotes(VALID, { tag: "v1.1.0" })).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects a body whose first non-empty line is not the wrapper", () => {
    const result = validateReleaseNotes(
      VALID.replace("## What's Changed", "# Release notes"),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/first non-empty line/i);
  });

  it("rejects a wrong emoji on a known section", () => {
    const result = validateReleaseNotes(
      VALID.replace("### 🚀 Features", "### ✨ Features"),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("✨ Features");
  });

  it("rejects a section outside the allowlist", () => {
    const result = validateReleaseNotes(
      `${VALID.replace("### 🚀 Features\n", "### 🚀 Features\n- A ([#1](https://github.com/ils15/open3dcalc/pull/1))\n\n### 🎉 Extras\n- B ([#2](https://github.com/ils15/open3dcalc/pull/2))\n")}`,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("🎉 Extras");
  });

  it("rejects sections rendered out of canonical order", () => {
    const result = validateReleaseNotes(`## What's Changed

### 🐛 Fixes
- Fix ([#2](https://github.com/ils15/open3dcalc/pull/2))

### 🚀 Features
- Feature ([#1](https://github.com/ils15/open3dcalc/pull/1))

**Full Changelog**: https://github.com/ils15/open3dcalc/compare/v1.0.0...v1.1.0
`);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/out of order/i);
  });

  it("rejects a malformed pull request link", () => {
    const result = validateReleaseNotes(
      VALID.replace(
        "[#10](https://github.com/ils15/open3dcalc/pull/10)",
        "[#10](https://github.com/ils15/open3dcalc/pull/11)",
      ),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/pull request link/i);
  });

  it("rejects a missing **Full Changelog** line", () => {
    const result = validateReleaseNotes(
      VALID.replace(
        "**Full Changelog**: https://github.com/ils15/open3dcalc/compare/v1.0.0...v1.1.0\n",
        "",
      ),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/Full Changelog/);
  });

  it("rejects any Downloads/Checksums mention", () => {
    const result = validateReleaseNotes(
      `${VALID}\n## Downloads\n- setup.exe\n`,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/Downloads or Checksums/);
  });

  it("rejects audit artifacts and inline author attribution", () => {
    const audit = `# Release notes

## Features
- fix: thing ([alice](https://github.com/alice)) — PR #3

## Downloads
- x

## Checksums
- y

## Full Changelog
- z
`;
    const result = validateReleaseNotes(audit);
    expect(result.ok).toBe(false);
    const joined = result.errors.join("\n");
    expect(joined).toMatch(/# Release notes/);
    expect(joined).toMatch(/— PR #/);
    expect(joined).toMatch(/Downloads/);
  });

  it("rejects non-bullet content lines", () => {
    const result = validateReleaseNotes(
      VALID.replace("- Add gizmo", "Add gizmo"),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/bullet/i);
  });

  it("rejects a Full Changelog that does not reference the expected tag", () => {
    const result = validateReleaseNotes(VALID, { tag: "v9.9.9" });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/v9\.9\.9/);
  });
});

describe("validate-release-notes CLI", () => {
  it("parses --file and --release, rejecting misuse", () => {
    expect(parseArgs(["--file", "notes.md"])).toEqual({
      file: "notes.md",
      release: undefined,
      tag: undefined,
    });
    expect(parseArgs(["--release", "v1.1.0", "--tag", "v1.1.0"]).release).toBe(
      "v1.1.0",
    );
    expect(() => parseArgs([])).toThrow("required");
    expect(() => parseArgs(["--file", "a", "--release", "v1.0.0"])).toThrow(
      "not both",
    );
    expect(() => parseArgs(["--file"])).toThrow("requires a value");
    expect(() => parseArgs(["--file", "a", "--nope"])).toThrow("Unknown flag");
  });

  it("validates a --file body and reports failures without throwing", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "validate-notes-"));
    const good = resolve(dir, "good.md");
    const bad = resolve(dir, "bad.md");
    await writeFile(good, VALID, "utf8");
    await writeFile(bad, "# Release notes\n## Downloads\n", "utf8");
    expect(await main(["--file", good])).toMatchObject({ ok: true });
    const failure = await main(["--file", bad]);
    expect(failure.ok).toBe(false);
    expect(failure.errors.length).toBeGreaterThan(0);
  });

  it("fetches and validates a published release body via gh", async () => {
    const calls: Array<{ repository: string; tag: string }> = [];
    const result = await main(["--release", "v1.1.0"], {
      fetchReleaseBody: async (repository, tag) => {
        calls.push({ repository, tag });
        return VALID;
      },
    });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.tag).toBe("v1.1.0");
  });

  it("uses the default gh api fetch when no override is injected", async () => {
    const result = await main(["--release", "v1.1.0"]);
    expect(result.ok).toBe(true);
    expect(result.source).toBe("release:v1.1.0");
  });
});
