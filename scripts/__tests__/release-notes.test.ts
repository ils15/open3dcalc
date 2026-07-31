import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  authorFor,
  categoryFor,
  collect,
  main,
  escapeMarkdown,
  normalize,
  render,
  sha256,
} from "../release-notes.mjs";

const fixture = async () =>
  JSON.parse(
    await readFile(
      resolve("scripts/__fixtures__/release-notes/aggregate.json"),
      "utf8",
    ),
  );

describe("audited release notes", () => {
  it("classifies English categories", () => {
    expect(categoryFor({ title: "security CVE" })).toBe("Security");
    expect(categoryFor({ title: "fix: regression" })).toBe("Fixes");
    expect(categoryFor({ title: "docs: README" })).toBe("Documentation");
  });
  it("uses PR author, then commit author, excluding bots", () => {
    expect(
      authorFor({
        pr: { user: { login: "alice" }, merged_by: { login: "reviewer" } },
        commit: { author: { login: "bob" } },
      }),
    ).toBe("alice");
    expect(authorFor({ commit: { author: { login: "bob" } } })).toBe("bob");
    expect(
      authorFor({ commit: { author: { login: "github-actions[bot]" } } }),
    ).toBe("Unknown");
  });
  it("deduplicates squash commits and sorts deterministically", async () => {
    const catalog = normalize(await fixture());
    expect(catalog.items.filter((item) => item.key === "pr:11")).toHaveLength(
      1,
    );
    expect(catalog.items.map((item) => item.key)).toEqual([
      "pr:10",
      "pr:11",
      "commit:ccc333",
    ]);
    expect(catalog.tags).toContain("v1.8.1-no-release");
  });
  it("renders the English contract and escapes hostile text", async () => {
    const markdown = render(normalize(await fixture()), "ils15/open3dcalc");
    expect(markdown).toContain("## Downloads");
    expect(markdown).toContain("## Checksums");
    expect(markdown).toContain("## Contributors");
    expect(markdown).toContain("## Full Changelog");
    expect(escapeMarkdown("<script>alert(1)</script>")).not.toContain(
      "<script>",
    );
  });
  it("produces stable checksums and idempotent output", async () => {
    const data = await fixture();
    expect(sha256(data)).toBe(sha256(data));
    expect(JSON.stringify(normalize(data))).toBe(
      JSON.stringify(normalize(data)),
    );
  });
  it("covers the v1.5.0 through v1.9.2 aggregate fixture", async () => {
    const catalog = normalize(await fixture());
    expect(catalog.releases.map((release) => release.tag)).toEqual([
      "v1.5.0",
      "v1.9.2",
    ]);
    expect(
      catalog.assets.find((asset) => asset.name === "latest.yml")?.digest,
    ).toBe("Not available");
  });
  it("collects associated PRs through the commit endpoint and preserves partial errors", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      calls.push(url);
      if (url.includes("/commits/abc/pulls")) {
        if (
          calls.filter((call) => call.includes("/commits/abc/pulls")).length ===
          1
        )
          return new Response("busy", {
            status: 429,
            headers: { "retry-after": "0" },
          });
        return new Response("missing", { status: 404 });
      }
      if (url.includes("/commits?"))
        return Response.json([
          { sha: "abc", commit: { message: "fix: safe" } },
        ]);
      return Response.json([]);
    }) as typeof fetch;
    try {
      const catalog = await collect("owner/repo", "v1.0.0");
      expect(catalog.partial).toBe(true);
      expect(catalog.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: "commitPulls:abc", status: 404 }),
        ]),
      );
      expect(calls.some((call) => call.includes("/commits/abc/pulls"))).toBe(
        true,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("enforces CLI safety flags and writes audit-only offline output", async () => {
    await expect(main(["--all", "--unknown"])).rejects.toThrow("Unknown flag");
    await expect(main([])).rejects.toThrow("tag or --all");
    await expect(main(["--all", "--write"])).rejects.toThrow("never mutates");
    const output = await mkdtemp(resolve(tmpdir(), "release-notes-test-"));
    const audit = await main([
      "--all",
      "--dry-run",
      "--audit-only",
      "--input",
      "scripts/__fixtures__/release-notes/aggregate.json",
      "--output",
      output,
    ]);
    expect(audit.dryRun).toBe(true);
    await expect(
      readFile(resolve(output, "audit.json"), "utf8"),
    ).resolves.toContain('"partial": false');
    const renderedOutput = await mkdtemp(
      resolve(tmpdir(), "release-notes-rendered-"),
    );
    await main([
      "--all",
      "--input",
      "scripts/__fixtures__/release-notes/aggregate.json",
      "--output",
      renderedOutput,
    ]);
    await expect(
      readFile(resolve(renderedOutput, "release-notes.md"), "utf8"),
    ).resolves.toContain("# Release notes");
  });
  it("records malformed pages, paginates, validates tags, and renders failures", async () => {
    const originalFetch = globalThis.fetch;
    const calls = new Map<string, number>();
    globalThis.fetch = (async (url: string) => {
      const key = url.split("?")[0];
      const count = (calls.get(key) ?? 0) + 1;
      calls.set(key, count);
      if (key.endsWith("/releases")) return Response.json({ unexpected: true });
      if (key.endsWith("/tags"))
        return Response.json(
          count === 1
            ? Array.from({ length: 100 }, (_, index) => ({
                name: `v1.0.${index}`,
              }))
            : [],
        );
      return Response.json([]);
    }) as typeof fetch;
    try {
      const catalog = await collect("owner/repo");
      expect(catalog.partial).toBe(true);
      expect(catalog.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: "invalid_payload" }),
        ]),
      );
      expect(render({ ...catalog, partial: true }, "owner/repo")).toContain(
        "Partial collection",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
    globalThis.fetch = (async (url: string) =>
      url.includes("/releases?")
        ? Response.json([{ tag_name: "v1.0.0", assets: [{ name: "app.zip" }] }])
        : Response.json([])) as typeof fetch;
    try {
      const selected = await collect("owner/repo", "v1.0.0");
      expect(selected.releases[0]?.tag).toBe("v1.0.0");
      expect(selected.assets[0]?.name).toBe("app.zip");
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(
      authorFor({
        pr: { user: { login: "service", type: "Bot" } },
        commit: { author: { login: "human" } },
      }),
    ).toBe("Unknown");
    await expect(main(["--release", "bad"])).rejects.toThrow("vX.Y.Z");
    await expect(main(["--all", "--output"])).rejects.toThrow(
      "requires a value",
    );
  });
});
