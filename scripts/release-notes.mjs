#!/usr/bin/env node
/** Deterministic, read-only release notes generator. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

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
const repositoryPattern =
  /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38})?)\/([A-Za-z0-9_.-]{1,100})$/;
export const COMMIT_PULL_CONCURRENCY = 4;
const clean = (value, fallback = "Unknown") =>
  String(value ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .trim()
    .slice(0, MAX) || fallback;
const validNumber = (value) => Number.isInteger(value) && value > 0;
const isBot = (person) => {
  const login = String(person?.login ?? "").toLowerCase();
  return person?.type === "Bot" || login.endsWith("[bot]") || BOTS.has(login);
};
export const escapeMarkdown = (value) =>
  clean(value, "Not available").replace(/([\\`*_{}\[\]()<>#+.!|])/g, "\\$1");
export const sha256 = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const categoryFor = (item) => {
  const text =
    `${item.title ?? ""} ${item.body ?? ""} ${(item.labels ?? []).map((label) => label.name ?? label).join(" ")}`.toLowerCase();
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
const personLogin = (person) => clean(person?.login ?? person?.name);
export const authorFor = (item) => {
  const prAuthor = item.pr?.user;
  if (prAuthor) return isBot(prAuthor) ? "Unknown" : personLogin(prAuthor);
  const commitAuthor = item.commit?.author ?? item.author;
  return commitAuthor && !isBot(commitAuthor)
    ? personLogin(commitAuthor)
    : "Unknown";
};
const version = (tag) => (/^v\d+\.\d+\.\d+$/.test(tag) ? tag : null);
const compare = (a, b) =>
  String(a).localeCompare(String(b), "en", { numeric: true });

export const validateRepository = (repository) => {
  const match = repositoryPattern.exec(
    typeof repository === "string" ? repository : "",
  );
  if (!match)
    throw new Error(
      "repository must contain only a safe GitHub owner/repo path",
    );
  return { owner: match[1], repo: match[2] };
};

const itemKey = (pr, commit) =>
  validNumber(pr?.number)
    ? `pr:${pr.number}`
    : commit?.sha
      ? `commit:${commit.sha}`
      : null;
export const normalize = (input) => {
  const releases = input.releases ?? [],
    tags = input.tags ?? [],
    commits = input.commits ?? [],
    prs = [
      ...(input.pullRequests ?? input.prs ?? []),
      ...(input.associatedPullRequests ?? []),
    ];
  const errors = input.errors ?? [];
  const assets =
    input.assets ??
    releases.flatMap((release) =>
      (release.assets ?? []).map((asset) => ({
        ...asset,
        release: release.tag_name,
      })),
    );
  const prBySha = new Map();
  for (const pr of prs)
    for (const sha of [
      ...(pr.commits ?? pr.commitShas ?? []),
      pr.merge_commit_sha,
    ].filter(Boolean)) {
      const existing = prBySha.get(sha);
      if (!existing || (pr.merged === true && existing.merged !== true))
        prBySha.set(sha, pr);
    }
  for (const association of input.commitPullRequests ?? [])
    for (const pr of association.pullRequests ?? []) {
      for (const sha of [association.sha, pr.merge_commit_sha].filter(
        Boolean,
      )) {
        const existing = prBySha.get(sha);
        if (!existing || (pr.merged === true && existing.merged !== true))
          prBySha.set(sha, pr);
      }
    }
  const seen = new Map();
  const aliases = new Map();
  const add = (commit, pr) => {
    if (pr && !validNumber(pr.number)) pr = undefined;
    const key = itemKey(pr, commit);
    if (!key) return;
    const identityKeys = [
      key,
      validNumber(pr?.number) ? `pr:${pr.number}` : null,
      pr?.merge_commit_sha ? `commit:${pr.merge_commit_sha}` : null,
      commit?.sha ? `commit:${commit.sha}` : null,
    ].filter(Boolean);
    const existingKey = identityKeys
      .map((identity) => aliases.get(identity))
      .find(Boolean);
    const current = existingKey ? seen.get(existingKey) : undefined;
    if (current && !(pr?.merged === true && !current.pr?.merged)) return;
    const item = {
      key,
      sha: clean(commit?.sha ?? pr?.merge_commit_sha),
      title: clean(pr?.title ?? commit?.message),
      body: clean(pr?.body, ""),
      pr,
      commit,
      category: categoryFor({ ...commit, ...pr }),
      author: authorFor({ pr, commit }),
    };
    if (existingKey && existingKey !== key) seen.delete(existingKey);
    seen.set(key, item);
    for (const identity of identityKeys) aliases.set(identity, key);
  };
  for (const commit of commits) add(commit, prBySha.get(commit.sha));
  for (const pr of prs.filter((candidate) => candidate.merged !== false))
    add(undefined, pr);
  const items = [...seen.values()].sort(
    (a, b) =>
      compare(a.category, b.category) ||
      compare(a.title, b.title) ||
      compare(a.key, b.key),
  );
  return {
    partial: Boolean(input.partial || errors.length),
    errors,
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
  if (catalog.partial)
    lines.push(
      "> **Partial collection:** some GitHub responses failed; see the audit inventory for evidence.",
      "",
    );
  for (const category of CATEGORIES) {
    const entries = catalog.items.filter((item) => item.category === category);
    if (!entries.length) continue;
    lines.push(`## ${category}`, "");
    for (const item of entries) {
      const prNumber = validNumber(item.pr?.number);
      const suffix = prNumber
        ? ` — PR #${item.pr.number}`
        : ` — commit ${tick}${escapeMarkdown(item.sha)}${tick}`;
      const author =
        item.author === "Unknown"
          ? "Unknown"
          : `[${escapeMarkdown(item.author)}](https://github.com/${encodeURIComponent(item.author)})`;
      lines.push(`- ${escapeMarkdown(item.title)} (${author})${suffix}`);
    }
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

class GitHubError extends Error {
  constructor(url, status, attempts) {
    super(`GitHub request failed with status ${status}`);
    this.url = url;
    this.status = status;
    this.attempts = attempts;
  }
}
const retryable = new Set([429, 500, 502, 503, 504]);
const BASE_RETRY_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 30_000;
export const retryDelayMs = (retryAfterHeader, attempt) => {
  const value =
    typeof retryAfterHeader === "string" ? retryAfterHeader.trim() : "";
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    if (Number.isSafeInteger(seconds))
      return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
  }
  return Math.min(
    BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempt),
    MAX_RETRY_DELAY_MS,
  );
};
const delayFor = (response, attempt) =>
  retryDelayMs(response.headers.get("retry-after"), attempt);
export async function fetchJson(url, attempt = 0) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/vnd.github+json",
      ...(process.env.GH_TOKEN
        ? { authorization: `Bearer ${process.env.GH_TOKEN}` }
        : {}),
    },
  });
  if (retryable.has(response.status) && attempt < 4) {
    await new Promise((resolveDelay) =>
      setTimeout(resolveDelay, delayFor(response, attempt)),
    );
    return fetchJson(url, attempt + 1);
  }
  if (response.status === 404) throw new GitHubError(url, 404, attempt + 1);
  if (!response.ok) throw new GitHubError(url, response.status, attempt + 1);
  return response.json();
}
async function pages(url, errors, label) {
  const result = [];
  for (let page = 1; ; page++) {
    try {
      const data = await fetchJson(
        `${url}${url.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
      );
      if (!Array.isArray(data)) {
        errors.push({ label, page, status: "invalid_payload" });
        return result;
      }
      result.push(...data);
      if (data.length < 100) return result;
    } catch (error) {
      errors.push({
        label,
        page,
        status: error.status ?? "network",
        attempts: error.attempts ?? 1,
        message: error.message,
      });
      return result;
    }
  }
}
async function mapWithConcurrency(items, worker, limit) {
  const results = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}
export async function collect(repository, release) {
  const { owner, repo } = validateRepository(repository);
  const base = `https://api.github.com/repos/${owner}/${repo}`,
    errors = [];
  const releases = await pages(`${base}/releases`, errors, "releases");
  const tags = await pages(`${base}/tags`, errors, "tags");
  const commits = await pages(`${base}/commits`, errors, "commits");
  const prs = await pages(`${base}/pulls?state=closed`, errors, "pullRequests");

  // The paginated pull-request response already contains merge_commit_sha for
  // the usual squash/merge cases. Only unresolved SHAs need the per-commit
  // endpoint. Keep one promise per SHA so duplicate commit records never
  // create duplicate requests.
  const knownPullRequests = new Map();
  for (const pr of prs) {
    for (const sha of [
      ...(pr.commits ?? pr.commitShas ?? []),
      pr.merge_commit_sha,
    ].filter(Boolean)) {
      const existing = knownPullRequests.get(sha) ?? [];
      existing.push(pr);
      knownPullRequests.set(sha, existing);
    }
  }
  const commitPullCache = new Map();
  const pullRequestsForCommit = (sha) => {
    const known = knownPullRequests.get(sha);
    if (known?.length) return Promise.resolve(known);
    if (!commitPullCache.has(sha))
      commitPullCache.set(
        sha,
        pages(
          `${base}/commits/${encodeURIComponent(sha)}/pulls`,
          errors,
          `commitPulls:${sha}`,
        ),
      );
    return commitPullCache.get(sha);
  };
  const associations = await mapWithConcurrency(
    commits,
    async (commit) => {
      const sha = String(commit.sha ?? "");
      if (!sha || /[\u0000-\u001f\u007f/\\]/.test(sha)) {
        errors.push({
          label: `commitPulls:${sha || "unknown"}`,
          status: "invalid_sha",
        });
        return { sha, pullRequests: [] };
      }
      return { sha, pullRequests: await pullRequestsForCommit(sha) };
    },
    COMMIT_PULL_CONCURRENCY,
  );
  const associated = associations.flatMap(
    (association) => association.pullRequests,
  );
  const allPrs = [...prs, ...associated];
  const selected = release
    ? releases.filter((item) => item.tag_name === release)
    : releases;
  return normalize({
    releases: selected,
    tags,
    commits,
    pullRequests: allPrs,
    commitPullRequests: associations,
    assets: selected.flatMap((item) => item.assets ?? []),
    errors,
    partial: errors.length > 0,
  });
}

const usage =
  "Usage: node scripts/release-notes.mjs (--release vX.Y.Z | --all) [--dry-run] [--audit-only] [--input file] [--output dir]";
const parseArgs = (argv) => {
  const allowed = new Set([
    "--dry-run",
    "--audit-only",
    "--all",
    "--write",
    "--release",
    "--input",
    "--output",
  ]);
  for (const arg of argv)
    if (arg.startsWith("--") && !allowed.has(arg))
      throw new Error(`Unknown flag: ${arg}\n${usage}`);
  const value = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  if (argv.includes("--write"))
    throw new Error(
      "--write is intentionally disabled; this tool never mutates GitHub.",
    );
  const release = value("--release");
  if (release && !version(release))
    throw new Error("--release must be a tag in vX.Y.Z format");
  if (!release && !argv.includes("--all"))
    throw new Error(`${usage}\nA release tag or --all is required.`);
  for (const name of ["--release", "--input", "--output"])
    if (argv.includes(name) && (!value(name) || value(name).startsWith("--")))
      throw new Error(`${name} requires a value`);
  return {
    release,
    all: argv.includes("--all"),
    dryRun: argv.includes("--dry-run"),
    auditOnly: argv.includes("--audit-only"),
    input: value("--input"),
    output: resolve(value("--output") ?? "release-notes-output"),
  };
};
export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv),
    repository = process.env.GITHUB_REPOSITORY ?? "ils15/open3dcalc";
  validateRepository(repository);
  const catalog = normalize(
    options.input
      ? JSON.parse(await readFile(resolve(options.input), "utf8"))
      : await collect(repository, options.release),
  );
  const audit = {
    schema: 2,
    repository,
    release: options.release ?? "all",
    dryRun: options.dryRun,
    partial: catalog.partial,
    inputSha256: sha256(catalog),
    outputSha256: sha256(render(catalog, repository)),
    catalog,
  };
  await mkdir(options.output, { recursive: true });
  await writeFile(
    resolve(options.output, "inventory.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  await writeFile(
    resolve(options.output, "audit.json"),
    `${JSON.stringify(audit, null, 2)}\n`,
  );
  if (!options.auditOnly) {
    const markdown = render(catalog, repository);
    await writeFile(
      resolve(options.output, "release-notes.md"),
      `${markdown}\n`,
    );
    await writeFile(
      resolve(options.output, "release-notes.diff"),
      `--- generated\n+++ audited\n@@\n+${markdown.split("\n").join("\n+\n")}`,
    );
  }
  return audit;
}
if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
