#!/usr/bin/env node
/** Deterministic, read-only release notes generator. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const CATEGORIES = [
  "Highlights",
  "Features",
  "Improvements",
  "Chores",
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
// Inline-safe escaping for item titles. Parentheses, plus signs, hashes and
// exclamation marks are legitimate conventional-commit subject characters and
// cannot start a heading inside a `- ` bullet, so they stay literal. Only the
// characters that can break inline Markdown or inject HTML are escaped.
export const escapeInline = (value) =>
  clean(value, "Not available").replace(/([\\`*_[\]<>|])/g, "\\$1");
export const sha256 = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const CONVENTIONAL_PREFIXES = {
  feat: "Features",
  fix: "Fixes",
  perf: "Improvements",
  refactor: "Chores",
  style: "Chores",
  test: "Chores",
  build: "Chores",
  chore: "Chores",
  docs: "Documentation",
  ci: "CI/CD",
  deps: "Dependencies",
  security: "Security",
};
const HIGHLIGHT_LIMIT = 3;
export const SUBJECT_LIMIT = 100;
// First physical line of a raw message; commit bodies never survive this.
const firstLine = (value) =>
  String(value ?? "")
    .split(/\r?\n/, 1)[0]
    .replace(/[\u0000-\u001f]/g, " ")
    .trim();
// Commit-only items render just the subject, bounded to a readable length.
const commitSubject = (value) => {
  const line = firstLine(value).slice(0, SUBJECT_LIMIT);
  return line || clean(value);
};
const breakingBody = (item) =>
  [item?.body, item?.commit?.message, item?.message]
    .filter((value) => typeof value === "string" && value.length)
    .join("\n");
export const categoryFor = (item) => {
  // Classify from the conventional-commit subject (first line) plus, only for
  // the explicit footer, the message body. The body is never keyword-scanned:
  // prose like "breaking intencional" must not elevate an item.
  const subject = firstLine(
    item?.title ?? item?.message ?? item?.commit?.message ?? item?.pr?.title,
  );
  const lower = subject.toLowerCase();
  if (subject.includes("!:") || /^BREAKING[ -]CHANGE\b/.test(subject))
    return "Breaking Changes";
  // The explicit Conventional Commits footer wins over the type/scope mapping.
  if (/\bBREAKING[ -]CHANGE\b/.test(breakingBody(item)))
    return "Breaking Changes";
  const conventional = /^([a-z]+)(?:\(([^)]*)\))?(!)?:/.exec(lower);
  if (conventional) {
    const [, prefix, scope] = conventional;
    if (scope && /(?:^|[-_])deps?(?:$|[-_])|dependencies/.test(scope))
      return "Dependencies";
    if (prefix === "chore" && scope === "ci") return "CI/CD";
    if (CONVENTIONAL_PREFIXES[prefix]) return CONVENTIONAL_PREFIXES[prefix];
  }
  // Subject-only fallbacks for non-conventional titles (dependency bots,
  // free-form prose, maintenance types).
  if (
    /\bbump\b[\s\S]*\bfrom\b[\s\S]*\bto\b|\bdependabot\b|\brenovate\b/.test(
      lower,
    )
  )
    return "Dependencies";
  if (/security|cve|vulnerab/.test(lower)) return "Security";
  // Anchored \bci\b so "calculator"/"calculadora" never land in CI/CD.
  if (/\bci\b|workflow|github action|pipeline/.test(lower)) return "CI/CD";
  if (/doc|readme|typo/.test(lower)) return "Documentation";
  if (/fix|bug|patch|regression/.test(lower)) return "Fixes";
  if (/feature|add|support|implement/.test(lower)) return "Features";
  if (/improv|perf|enhanc/.test(lower)) return "Improvements";
  if (/chore|refactor|style|test|build|tidy/.test(lower)) return "Chores";
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
const semverOf = (tag) => {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(String(tag ?? ""));
  return match
    ? {
        tag: String(tag),
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
      }
    : null;
};
const semverCompare = (a, b) =>
  a.major - b.major || a.minor - b.minor || a.patch - b.patch;
// Highest SemVer tag strictly older than `release`, or null for the first one.
const previousReleaseFor = (tags, release) => {
  const target = semverOf(release);
  if (!target) return null;
  const older = tags
    .map((tag) => semverOf(tag.name ?? tag))
    .filter((candidate) => candidate && semverCompare(candidate, target) < 0)
    .sort((a, b) => semverCompare(b, a));
  return older[0]?.tag ?? null;
};
// The /commits list is newest-first, so its last entry is the oldest
// commit reachable from the default branch; the first tagged release is
// compared from that commit so every commit up to the tag is included.
const changelogEntry = (repository, range, releases) => {
  // The same escaping used across the render: URL components are
  // encodeURIComponent'd first (neutralizing quotes/angles/whitespace) and
  // then escapeMarkdown'd so the parens and brackets that
  // encodeURIComponent leaves behind can never break or inject into the
  // parens-form Markdown link destination.
  const repositoryUrl = `https://github.com/${escapeMarkdown(repository)}`;
  if (range?.release) {
    const target = escapeMarkdown(encodeURIComponent(range.release));
    return range.previous
      ? `[Full Changelog](${repositoryUrl}/compare/${escapeMarkdown(encodeURIComponent(range.previous))}...${target})`
      : `[Full Changelog](${repositoryUrl}/commits/${target})`;
  }
  const versionedTags = (releases ?? [])
    .map((release) => release.tag)
    .filter((tag) => version(tag));
  return versionedTags.length >= 2
    ? `[Full Changelog](${repositoryUrl}/compare/${escapeMarkdown(encodeURIComponent(versionedTags[0]))}...${escapeMarkdown(encodeURIComponent(versionedTags[versionedTags.length - 1]))})`
    : "- Generated from the audited tag, commit, pull request, and asset inventory.";
};

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
    const rawTitle = pr?.title ?? commit?.message ?? commit?.commit?.message;
    // PR titles are single-line by contract; commit-only items must keep just
    // the conventional-commit subject so multi-line bodies never leak in.
    const title = pr?.title ? clean(rawTitle) : commitSubject(rawTitle);
    const item = {
      key,
      sha: clean(commit?.sha ?? pr?.merge_commit_sha),
      title,
      body: clean(pr?.body, ""),
      pr,
      commit,
      category: categoryFor({ ...commit, ...pr, title }),
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
    range: input.range ?? null,
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
    let entries = catalog.items.filter((item) => item.category === category);
    if (category === "Highlights" && !entries.length) {
      // Deterministic highlights: the first Features entries in canonical
      // item order, so the section never stays empty when Features items exist.
      entries = catalog.items
        .filter((item) => item.category === "Features")
        .slice(0, HIGHLIGHT_LIMIT);
    }
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
      lines.push(`- ${escapeInline(item.title)} (${author})${suffix}`);
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
    changelogEntry(repository, catalog.range, catalog.releases),
    "",
  );
  return lines.join("\n");
};

// Canonical GitHub publication sections: exact `###` heading (emoji included)
// in the fixed public order and the audited catalog categories that feed each
// one. Chores absorbs the audit-only Improvements/Other Changes buckets so the
// chore/refactor/style commit types share a single public section. Empty
// sections are omitted; Downloads/Checksums are deliberately never published.
export const PUBLICATION_SECTIONS = [
  { heading: "🚀 Features", categories: ["Features", "Highlights"] },
  { heading: "🐛 Fixes", categories: ["Fixes"] },
  {
    heading: "🧹 Chores",
    categories: ["Chores", "Improvements", "Other Changes"],
  },
  { heading: "📦 Dependencies", categories: ["Dependencies"] },
  { heading: "🤖 CI/CD", categories: ["CI/CD"] },
  { heading: "📚 Documentation", categories: ["Documentation"] },
  { heading: "🔒 Security", categories: ["Security"] },
  { heading: "⚠️ Breaking Changes", categories: ["Breaking Changes"] },
];
const isBotLogin = (login) => {
  const value = String(login ?? "").toLowerCase();
  return value === "unknown" || value.endsWith("[bot]") || BOTS.has(value);
};
const shortSha = (sha) => clean(sha, "").slice(0, 7);
const publicationChangelog = (repository, tag, previousTag) => {
  const repositoryUrl = `https://github.com/${escapeMarkdown(repository)}`;
  const component = (value) => encodeURIComponent(String(value));
  if (previousTag && tag)
    return `${repositoryUrl}/compare/${component(previousTag)}...${component(tag)}`;
  // First tagged release: only a commit list exists, mirroring the audit render.
  if (tag) return `${repositoryUrl}/commits/${component(tag)}`;
  return repositoryUrl;
};
/**
 * Render the canonical GitHub release body (EN, emoji sections, deterministic).
 *
 * @param {object} catalog Normalized catalog returned by `normalize()`.
 * @param {string} [repository] GitHub `owner/repo` slug.
 * @param {{ tag?: string, previousTag?: string }} [range] Release tag and the
 *   previous SemVer tag used to build the Full Changelog compare link.
 * @returns {string} Markdown body, byte-identical across re-runs.
 */
export const renderPublication = (
  catalog,
  repository = "repository",
  { tag, previousTag } = {},
) => {
  const releaseTag = tag ?? catalog.range?.release ?? null;
  const priorTag = previousTag ?? catalog.range?.previous ?? null;
  const lines = ["## What's Changed", ""];
  for (const { heading, categories } of PUBLICATION_SECTIONS) {
    const entries = catalog.items
      .filter((item) => categories.includes(item.category))
      .sort((a, b) => compare(a.title, b.title) || compare(a.key, b.key));
    if (!entries.length) continue;
    lines.push(`### ${heading}`, "");
    for (const item of entries) {
      const prNumber = validNumber(item.pr?.number);
      const suffix = prNumber
        ? `([#${item.pr.number}](https://github.com/${escapeMarkdown(repository)}/pull/${item.pr.number}))`
        : `(commit ${escapeMarkdown(shortSha(item.sha))})`;
      lines.push(`- ${escapeInline(item.title)} ${suffix}`);
    }
    lines.push("");
  }
  const contributors = [...new Set(catalog.items.map((item) => item.author))]
    .filter((author) => author && !isBotLogin(author))
    .sort(compare);
  if (contributors.length) {
    lines.push("### ❤️ Contributors", "");
    lines.push(...contributors.map((author) => `@${escapeMarkdown(author)}`));
    lines.push("");
  }
  lines.push(
    `**Full Changelog**: ${publicationChangelog(repository, releaseTag, priorTag)}`,
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
// compare/<base>...<head> returns { status, ahead_by, behind_by, commits }.
// The commits[] list is paginated with per_page/page; guard against API
// layers that ignore pagination and would echo the same first page forever.
async function fetchCompareCommits(base, baseRef, headRef, errors) {
  const label = `compare:${baseRef}...${headRef}`;
  const commits = [];
  let firstShaOfPreviousPage = null;
  for (let page = 1; ; page++) {
    try {
      const data = await fetchJson(
        `${base}/compare/${encodeURIComponent(baseRef)}...${encodeURIComponent(headRef)}?per_page=100&page=${page}`,
      );
      if (!Array.isArray(data?.commits)) {
        errors.push({ label, page, status: "invalid_payload" });
        return { commits, ok: false };
      }
      if (
        data.commits.length &&
        data.commits[0]?.sha === firstShaOfPreviousPage
      ) {
        // Pagination ignored by the server: the same page repeats. Stop
        // before duplicating entries instead of looping forever.
        return { commits, ok: true };
      }
      if (data.commits.length) firstShaOfPreviousPage = data.commits[0]?.sha;
      commits.push(...data.commits);
      if (data.commits.length < 100) return { commits, ok: true };
    } catch (error) {
      errors.push({
        label,
        page,
        status: error.status ?? "network",
        attempts: error.attempts ?? 1,
        message: error.message,
      });
      return { commits, ok: false };
    }
  }
}
// Narrow the catalog to the commits introduced by `release`:
// - previous SemVer tag: compare/<previous>...<tag> (exact range);
// - first tagged release: compare/<oldest known commit>...<tag sha> (every
//   commit up to the tag, including the tag's own commit; the GitHub compare
//   API rejects the empty-tree base, so the oldest default-branch commit is
//   used instead);
// - compare unavailable: fall back to the full commit list and record the
//   failure so the rendered notes stay clearly "Partial collection".
async function scopeForRelease({
  base,
  errors,
  release,
  releases,
  tags,
  commits,
}) {
  const previous = previousReleaseFor(tags, release);
  if (previous) {
    const range = await fetchCompareCommits(base, previous, release, errors);
    return {
      commits: range.ok ? range.commits : commits,
      range: { release, previous },
    };
  }
  const tag = tags.find(
    (candidate) => (candidate.name ?? candidate) === release,
  );
  const targetRelease = releases.find(
    (candidate) => candidate.tag_name === release,
  );
  const head = tag?.commit?.sha ?? targetRelease?.target_commitish;
  // The /commits list is newest-first, so its last entry is the oldest
  // commit reachable from the default branch (the root for the first
  // tagged release).
  const oldestCommit = commits[commits.length - 1];
  const oldest = oldestCommit?.sha;
  if (head && oldest) {
    if (oldest === head) {
      // Single-commit edge case: the tag IS the oldest commit, so a compare
      // against itself would return zero commits; keep the tag's own commit
      // as a valid commit object so normalize() never drops it.
      return { commits: [{ sha: head }], range: { release, previous: null } };
    }
    const range = await fetchCompareCommits(base, oldest, head, errors);
    // The compare API excludes its base commit from the commits[] payload,
    // so when the base is the default-branch root the first release would
    // silently miss the root commit. Prepend it — unless the server already
    // included it — so "all commits up to the tag, including the root" holds.
    const scoped = range.ok
      ? range.commits.some((commit) => commit?.sha === oldest)
        ? range.commits
        : [oldestCommit, ...range.commits]
      : commits;
    return {
      commits: scoped,
      range: { release, previous: null },
    };
  }
  return { commits, range: { release, previous: null } };
}
const dedupePullRequests = (list) => {
  const unique = new Map();
  for (const pr of list) {
    const key = validNumber(pr?.number)
      ? `pr:${pr.number}`
      : (pr?.id ?? pr?.merge_commit_sha ?? JSON.stringify(pr));
    if (!unique.has(key)) unique.set(key, pr);
  }
  return [...unique.values()];
};
export async function collect(repository, release) {
  const { owner, repo } = validateRepository(repository);
  const base = `https://api.github.com/repos/${owner}/${repo}`,
    errors = [];
  const releases = await pages(`${base}/releases`, errors, "releases");
  const tags = await pages(`${base}/tags`, errors, "tags");
  const commits = await pages(`${base}/commits`, errors, "commits");
  const prs = await pages(`${base}/pulls?state=closed`, errors, "pullRequests");

  // Per-release catalogs scope commits to the previous...tag range; --all
  // keeps the aggregated repository-wide inventory.
  const scope = release
    ? await scopeForRelease({ base, errors, release, releases, tags, commits })
    : { commits, range: null };

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
    scope.commits,
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
  // Per-release catalogs must never include PRs from other releases: keep
  // only PRs associated with scoped commits instead of the full closed list.
  const allPrs = release
    ? dedupePullRequests(associated)
    : [...prs, ...associated];
  const selected = release
    ? releases.filter((item) => item.tag_name === release)
    : releases;
  return normalize({
    releases: selected,
    tags,
    commits: scope.commits,
    pullRequests: allPrs,
    commitPullRequests: associations,
    assets: selected.flatMap((item) => item.assets ?? []),
    errors,
    partial: errors.length > 0,
    range: scope.range,
  });
}

const usage =
  "Usage: node scripts/release-notes.mjs (--release vX.Y.Z | --all) [--dry-run] [--audit-only] [--input file] [--output dir] [--notes-file path]";
const parseArgs = (argv) => {
  const allowed = new Set([
    "--dry-run",
    "--audit-only",
    "--all",
    "--write",
    "--release",
    "--input",
    "--output",
    "--notes-file",
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
  for (const name of ["--release", "--input", "--output", "--notes-file"])
    if (argv.includes(name) && (!value(name) || value(name).startsWith("--")))
      throw new Error(`${name} requires a value`);
  return {
    release,
    all: argv.includes("--all"),
    dryRun: argv.includes("--dry-run"),
    auditOnly: argv.includes("--audit-only"),
    input: value("--input"),
    output: resolve(value("--output") ?? "release-notes-output"),
    notesFile: value("--notes-file"),
  };
};
export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv),
    repository = process.env.GITHUB_REPOSITORY ?? "ils15/open3dcalc";
  validateRepository(repository);
  // collect() already returns a normalized catalog; only raw --input JSON
  // needs normalization here. Re-normalizing an already normalized catalog
  // drops the renamed fields (tag/target/url) and leaves items empty.
  const catalog = options.input
    ? normalize(JSON.parse(await readFile(resolve(options.input), "utf8")))
    : await collect(repository, options.release);
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
  const publication = renderPublication(catalog, repository, {
    tag: options.release,
    previousTag: catalog.range?.previous,
  });
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
    await writeFile(
      resolve(options.output, "release-notes-publication.md"),
      `${publication}\n`,
    );
  }
  if (options.notesFile)
    await writeFile(resolve(options.notesFile), `${publication}\n`);
  return audit;
}
if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
