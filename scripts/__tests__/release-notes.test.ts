import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  authorFor,
  categoryFor,
  collect,
  COMMIT_PULL_CONCURRENCY,
  fetchJson,
  main,
  escapeMarkdown,
  normalize,
  render,
  retryDelayMs,
  sha256,
  validateRepository,
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
  it("extracts real titles from nested GitHub commit payloads", () => {
    const catalog = normalize({
      releases: [{ tag_name: "v1.0.0", assets: [] }],
      tags: [{ name: "v1.0.0" }],
      // Real GitHub API shape: { sha, commit: { message, ... }, author }
      commits: [
        {
          sha: "nested-nopr",
          commit: {
            message: "fix: direct commit without PR",
            author: { name: "Carol", email: "carol@example.com" },
          },
          author: { login: "carol" },
        },
        {
          sha: "nested-pr",
          commit: {
            message: "feat: nested payload merged via PR",
            author: { name: "Dave", email: "dave@example.com" },
          },
          author: { login: "dave" },
        },
      ],
      pullRequests: [
        {
          number: 101,
          title: "feat: nested payload merged via PR",
          merge_commit_sha: "nested-pr",
          user: { login: "dave" },
        },
      ],
    });
    expect(catalog.partial).toBe(false);
    expect(catalog.items.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "fix: direct commit without PR",
        "feat: nested payload merged via PR",
      ]),
    );
    // Regression: titles must never degrade to the "Unknown" fallback when
    // the payload is nested ({ sha, commit: { message } }) instead of flat.
    expect(catalog.items.map((item) => item.title)).not.toContain("Unknown");
    const direct = catalog.items.find(
      (item) => item.key === "commit:nested-nopr",
    );
    expect(direct).toMatchObject({
      title: "fix: direct commit without PR",
      author: "carol",
    });
    expect(catalog.items.find((item) => item.key === "pr:101")?.title).toBe(
      "feat: nested payload merged via PR",
    );
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
  it("validates repository paths before constructing REST URLs", async () => {
    expect(validateRepository("owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
    for (const repository of [
      "owner/repo/extra",
      "../repo",
      "owner/repo?x=1",
      "owner/repo\nmalicious",
    ])
      expect(() => validateRepository(repository)).toThrow("safe GitHub");

    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      calls.push(url);
      return Response.json([]);
    }) as typeof fetch;
    try {
      await collect("owner/repo");
      expect(calls[0]).toBe(
        "https://api.github.com/repos/owner/repo/releases?per_page=100&page=1",
      );
      expect(calls.some((call) => call.includes("repos/owner%2Frepo"))).toBe(
        false,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
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
  it("retries each transient 5xx response with bounded Retry-After backoff", async () => {
    const originalFetch = globalThis.fetch;
    const statuses = [500, 502, 503, 504];
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const attempts = new Map<string, number>();
    vi.useFakeTimers();
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      const index = Number(url.split("/").pop());
      const status = attempt === 1 ? statuses[index] : 200;
      return status === 200
        ? Response.json({ ok: true })
        : new Response("transient", {
            status,
            headers: { "retry-after": "1" },
          });
    }) as typeof fetch;
    try {
      const pending = Promise.all(
        statuses.map((_, index) => fetchJson(`https://example.test/${index}`)),
      );
      await vi.advanceTimersByTimeAsync(999);
      expect(calls).toHaveLength(4);
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual(
        statuses.map(() => ({ ok: true })),
      );
      expect(calls).toHaveLength(8);
      expect(calls.every(({ init }) => init?.method === "GET")).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
      vi.useRealTimers();
    }
  });
  it("uses deterministic bounded fallback for absent or invalid Retry-After", () => {
    expect(retryDelayMs(null, 0)).toBe(250);
    expect(retryDelayMs("", 1)).toBe(500);
    expect(retryDelayMs("not-a-delay", 99)).toBe(30_000);
    expect(retryDelayMs("999999", 0)).toBe(30_000);
    expect(retryDelayMs("0", 0)).toBe(0);
  });
  it("does not retry forbidden responses and records them as read-only failures", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      calls.push(url);
      return new Response("forbidden", { status: 403 });
    }) as typeof fetch;
    try {
      await expect(
        fetchJson("https://example.test/forbidden"),
      ).rejects.toMatchObject({
        status: 403,
        attempts: 1,
      });
      expect(calls).toEqual(["https://example.test/forbidden"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("uses the paginated PR batch before falling back to commit endpoints", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      calls.push(url);
      if (url.includes("/commits?"))
        return Response.json([
          { sha: "abc", commit: { message: "feat: batched" } },
        ]);
      if (url.includes("/pulls?"))
        return Response.json([{ number: 42, merge_commit_sha: "abc" }]);
      return Response.json([]);
    }) as typeof fetch;
    try {
      const catalog = await collect("owner/repo");
      expect(
        calls.filter((call) => call.includes("/commits/abc/pulls")),
      ).toHaveLength(0);
      expect(catalog.items[0]?.pr?.number).toBe(42);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("caches commit associations by SHA and limits fallback concurrency", async () => {
    const originalFetch = globalThis.fetch;
    const commitShas = ["aaa", "bbb", "ccc", "ddd", "eee", "aaa"];
    const calls: string[] = [];
    let active = 0;
    let maximumActive = 0;
    globalThis.fetch = (async (url: string) => {
      calls.push(url);
      if (url.includes("/commits/") && url.includes("/pulls")) {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 5));
        active -= 1;
      }
      if (url.includes("/commits?"))
        return Response.json(
          commitShas.map((sha) => ({
            sha,
            commit: { message: "fix: cached" },
          })),
        );
      return Response.json([]);
    }) as typeof fetch;
    try {
      await collect("owner/repo");
      expect(
        calls.filter((call) => /\/commits\/[^/]+\/pulls/.test(call)),
      ).toHaveLength(5);
      expect(maximumActive).toBeLessThanOrEqual(COMMIT_PULL_CONCURRENCY);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("keeps the backfill workflow shell-safe and read-only", async () => {
    const workflow = await readFile(
      resolve(".github/workflows/release-notes-backfill.yml"),
      "utf8",
    );
    const runSection = workflow.match(
      /\s{8}run: \|\n([\s\S]*?)(?=\n\s{6}- name: Upload audited artifacts)/,
    )?.[1];
    expect(workflow).toContain("RELEASE_TAG: ${{ inputs.tag }}");
    expect(runSection).toBeDefined();
    expect(runSection).not.toContain("${{ inputs.tag }}");
    expect(runSection).toContain(
      'if [[ -n "$RELEASE_TAG" && ! "$RELEASE_TAG" =~ ^v[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then',
    );
    expect(runSection).toContain('args+=(--release "$RELEASE_TAG")');
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toMatch(
      /gh\s+(release|api\s+--method\s+(POST|PATCH|DELETE)) /,
    );
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
  it("never re-normalizes collect() output in main(), keeping real tags, items, and asset URLs", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      if (url.includes("/commits/") && url.includes("/pulls"))
        return Response.json([]);
      if (url.includes("/releases"))
        return Response.json([
          {
            tag_name: "v1.0.0",
            target_commitish: "main",
            assets: [
              {
                name: "open3dcalc-v1.0.0.zip",
                browser_download_url:
                  "https://github.com/ils15/open3dcalc/releases/download/v1.0.0/open3dcalc-v1.0.0.zip",
                digest: "sha256:abc123",
              },
            ],
          },
        ]);
      if (url.includes("/tags")) return Response.json([{ name: "v1.0.0" }]);
      if (url.includes("/commits"))
        return Response.json([
          {
            sha: "abc123",
            commit: {
              message: "fix: double normalization",
              author: { login: "alice" },
            },
          },
        ]);
      if (url.includes("/pulls"))
        return Response.json([
          {
            number: 7,
            title: "fix: double normalization",
            merge_commit_sha: "abc123",
            user: { login: "alice" },
          },
        ]);
      return Response.json([]);
    }) as typeof fetch;
    try {
      const output = await mkdtemp(resolve(tmpdir(), "release-notes-dedupe-"));
      const audit = await main(["--all", "--dry-run", "--output", output]);
      const { catalog } = audit;
      expect(catalog.partial).toBe(false);
      expect(catalog.errors).toEqual([]);
      expect(catalog.tags).toContain("v1.0.0");
      expect(catalog.releases.map((release) => release.tag)).toEqual([
        "v1.0.0",
      ]);
      expect(catalog.releases[0]?.target).toBe("main");
      expect(catalog.releases[0]?.assets[0]?.url).toBe(
        "https://github.com/ils15/open3dcalc/releases/download/v1.0.0/open3dcalc-v1.0.0.zip",
      );
      expect(catalog.releases[0]?.assets[0]?.digest).toBe("sha256:abc123");
      expect(catalog.items).toHaveLength(1);
      expect(catalog.items[0]?.pr?.number).toBe(7);
      expect(catalog.items[0]?.title).toBe("fix: double normalization");
      // A second normalization pass would rename these fields to placeholders.
      const serialized = JSON.stringify(catalog);
      expect(serialized).not.toContain('"tag":"Unknown"');
      expect(serialized).not.toContain('"target":"Unknown"');
      expect(serialized).not.toContain('"url":"Not available"');
      expect(serialized).not.toContain('"digest":"Not available"');
      expect(serialized).not.toContain('"items":[]');
      const markdown = await readFile(
        resolve(output, "release-notes.md"),
        "utf8",
      );
      expect(markdown).toContain("fix: double normalization");
      expect(markdown).toContain("[alice](https://github.com/alice)");
      expect(markdown).toContain("## Full Changelog");
      expect(markdown).toContain("## Contributors");
    } finally {
      globalThis.fetch = originalFetch;
    }
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
