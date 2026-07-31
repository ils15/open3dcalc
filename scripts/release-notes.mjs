#!/usr/bin/env node
/** Audited, read-only release notes generator.  It never calls a mutating API. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

export const CATEGORIES = [
  "Highlights",
  "Features",
  "Improvements",
  "Fixes",
  "Security",
  "CI/CD",
  "Documentation",
  "Dependencies",
  "Breaking Changes",
  "Other Changes",
];
const BOTS = new Set([
  "github-actions",
  "dependabot",
  "renovate",
  "dependabot[bot]",
  "github-actions[bot]",
]);
const MAX = 240;
const clean = (value, fallback = "Unknown") =>
  String(value ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .trim() || fallback;
export const escapeMarkdown = (value) =>
  clean(value, "Not available")
    .replace(/([\\`*_{}\[\]()<>#+.!|])/g, "\\$1")
    .slice(0, MAX);
export const sha256 = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const categoryFor = (item) => {
  const text =
    `${item.title ?? ""} ${item.body ?? ""} ${item.labels?.map((label) => label.name ?? label).join(" ") ?? ""}`.toLowerCase();
  if (/breaking|!:|major change/.test(text)) return "Breaking Changes";
  if (/security|cve|vulnerab|dependabot|renovate/.test(text))
    return text.includes("depend") ? "Dependencies" : "Security";
  if (/ci|workflow|github action|pipeline|build/.test(text)) return "CI/CD";
  if (/doc|readme|typo/.test(text)) return "Documentation";
  if (/fix|bug|patch|regression/.test(text)) return "Fixes";
  if (/feature|add|support|implement/.test(text)) return "Features";
  if (/improv|refactor|perf|enhanc/.test(text)) return "Improvements";
  return "Other Changes";
};
const login = (person) => clean(person?.login ?? person?.name);
export const authorFor = (item) => {
  const candidates = [
    item.pr?.merged_by,
    item.pr?.user,
    item.commit?.author,
    item.author,
  ];
  for (const person of candidates) {
    const name = login(person);
    if (name !== "Unknown" && !BOTS.has(name.toLowerCase())) return name;
  }
  return "Unknown";
};
const version = (tag) => (/^v\d+\.\d+\.\d+$/.test(tag) ? tag : null);
const compare = (a, b) =>
  String(a).localeCompare(String(b), "en", { numeric: true });

export const normalize = (input) => {
  const releases = input.releases ?? [];
  const tags = input.tags ?? [];
  const commits = input.commits ?? [];
  const prs = input.pullRequests ?? input.prs ?? [];
  const assets =
    input.assets ??
    releases.flatMap((release) =>
      (release.assets ?? []).map((asset) => ({
        ...asset,
        release: release.tag_name,
      })),
    );
  const prBySha = new Map(
    prs.flatMap((pr) =>
      (pr.commits ?? pr.commitShas ?? []).map((sha) => [sha, pr]),
    ),
  );
  const seen = new Set();
  const items = [];
  for (const commit of commits) {
    const pr = commit.pullRequest ?? prBySha.get(commit.sha);
    const key = pr?.number ? `pr:${pr.number}` : `commit:${commit.sha}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = {
      key,
      sha: clean(commit.sha),
      title: clean(pr?.title ?? commit.message),
      body: clean(pr?.body, ""),
      pr,
      commit,
      category: categoryFor({ ...commit, ...pr }),
      author: authorFor({ pr, commit }),
    };
    items.push(item);
  }
  for (const pr of prs.filter((pr) => pr.merged !== false)) {
    const key = `pr:${pr.number}`;
    if (!seen.has(key)) {
      seen.add(key);
      items.push({
        key,
        sha: clean(pr.merge_commit_sha),
        title: clean(pr.title),
        body: clean(pr.body, ""),
        pr,
        category: categoryFor(pr),
        author: authorFor({ pr }),
      });
    }
  }
  items.sort(
    (a, b) =>
      compare(a.category, b.category) ||
      compare(a.title, b.title) ||
      compare(a.key, b.key),
  );
  return {
    releases: releases
      .map((release) => ({
        tag: clean(release.tag_name),
        id: release.id ?? null,
        target: clean(release.target_commitish),
        assets: (release.assets ?? []).map((asset) => ({
          name: clean(asset.name),
          digest: asset.digest ?? "Not available",
          url: clean(asset.browser_download_url, "Not available"),
        })),
      }))
      .sort((a, b) => compare(a.tag, b.tag)),
    tags: tags.map((tag) => clean(tag.name ?? tag)).sort(compare),
    items,
    assets: assets
      .map((asset) => ({
        name: clean(asset.name),
        digest: asset.digest ?? "Not available",
        release: clean(asset.release, "Not available"),
      }))
      .sort((a, b) => compare(a.name, b.name)),
    generatedAt: "deterministic",
  };
};

export const render = (catalog, repository = "repository") => {
  const tick = String.fromCharCode(96);
  const lines = [
    "# Release notes",
    "",
    `Audited release inventory for ${tick}${escapeMarkdown(repository)}${tick}.`,
    "",
  ];
  for (const category of CATEGORIES) {
    const entries = catalog.items.filter((item) => item.category === category);
    if (!entries.length) continue;
    lines.push(`## ${category}`, "");
    for (const item of entries)
      lines.push(
        `- ${escapeMarkdown(item.title)} ([${escapeMarkdown(item.author)}](https://github.com/${encodeURIComponent(item.author)}))${item.pr?.number ? ` — PR #${item.pr.number}` : ` — commit ${tick}${escapeMarkdown(item.sha)}${tick}`}`,
      );
    lines.push("");
  }
  lines.push(
    "## Downloads",
    "",
    ...(catalog.assets.length
      ? catalog.assets.map(
          (asset) =>
            `- ${escapeMarkdown(asset.name)} — ${escapeMarkdown(asset.digest)}`,
        )
      : ["- Not available"]),
    "",
    "## Checksums",
    "",
    "- SHA-256 values are recorded in the audit inventory; Not available when GitHub provides no digest.",
    "",
    "## Contributors",
    "",
    ...[...new Set(catalog.items.map((item) => item.author))]
      .sort(compare)
      .map((author) => `- ${escapeMarkdown(author)}`),
    "",
    "## Full Changelog",
    "",
    "- Generated from the audited tag, commit, pull request, and asset inventory.",
    "",
  );
  return lines.join("\n");
};

async function fetchJson(url, attempt = 0) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      ...(process.env.GH_TOKEN
        ? { authorization: `Bearer ${process.env.GH_TOKEN}` }
        : {}),
    },
  });
  if ([403, 429, 500, 502, 503, 504].includes(response.status) && attempt < 4) {
    await new Promise((resolveDelay) =>
      setTimeout(resolveDelay, 250 * 2 ** attempt),
    );
    return fetchJson(url, attempt + 1);
  }
  if (!response.ok)
    throw new Error(`GitHub request failed with status ${response.status}`);
  return response.json();
}
async function pages(url) {
  const result = [];
  for (let page = 1; ; page++) {
    const data = await fetchJson(
      `${url}${url.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    );
    result.push(...(Array.isArray(data) ? data : []));
    if (!Array.isArray(data) || data.length < 100) return result;
  }
}
export async function collect(repository, release) {
  const base = `https://api.github.com/repos/${encodeURIComponent(repository)}`;
  const [releases, tags, commits, prs] = await Promise.all([
    pages(`${base}/releases`),
    pages(`${base}/tags`),
    pages(`${base}/commits`),
    pages(`${base}/pulls?state=closed`),
  ]).then((values) => values);
  const selected = release
    ? releases.filter((item) => item.tag_name === release)
    : releases;
  const assets = selected.flatMap((item) => item.assets ?? []);
  return normalize({
    releases: selected,
    tags,
    commits,
    pullRequests: prs,
    assets,
  });
}
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
export async function main(argv = args) {
  if (argv.includes("--write"))
    throw new Error(
      "--write is intentionally disabled in this PR; mutable backfill will be implemented in a separate workflow after approval.",
    );
  const inputPath = value("--input");
  const output = resolve(value("--output") ?? "release-notes-output");
  const repository = process.env.GITHUB_REPOSITORY ?? "ils15/open3dcalc";
  const release = value("--release");
  if (release && !version(release))
    throw new Error("--release must be a tag in vX.Y.Z format");
  const catalog = normalize(
    inputPath
      ? JSON.parse(await readFile(resolve(inputPath), "utf8"))
      : await collect(repository, release),
  );
  const audit = {
    schema: 1,
    repository,
    release: release ?? "all",
    inputSha256: sha256(catalog),
    outputSha256: sha256(render(catalog, repository)),
    catalog,
  };
  await mkdir(output, { recursive: true });
  await writeFile(
    resolve(output, "inventory.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  await writeFile(
    resolve(output, "audit.json"),
    `${JSON.stringify(audit, null, 2)}\n`,
  );
  if (!flag("--audit-only")) {
    const markdown = render(catalog, repository);
    await writeFile(resolve(output, "release-notes.md"), `${markdown}\n`);
    await writeFile(
      resolve(output, "release-notes.diff"),
      `--- generated\n+++ audited\n@@\n+${markdown.split("\n").join("\n+")}\n`,
    );
  }
  return audit;
}
if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
