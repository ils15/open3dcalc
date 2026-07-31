import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  authorFor,
  categoryFor,
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
  it("uses merged author, then commit author, excluding bots", () => {
    expect(
      authorFor({
        pr: { merged_by: { login: "alice" } },
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
});
