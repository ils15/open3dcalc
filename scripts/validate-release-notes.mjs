#!/usr/bin/env node
/**
 * Deterministic, read-only validator for GitHub release bodies.
 *
 * Enforces the canonical publication format produced by `renderPublication()`:
 * the `## What's Changed` wrapper, emoji `###` sections in the fixed order,
 * `- ` bullets, well-formed PR links, and exactly one `**Full Changelog**`
 * line. Audit artifacts and Downloads/Checksums sections are rejected.
 */
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { PUBLICATION_SECTIONS } from "./release-notes.mjs";

const execFileAsync = promisify(execFile);

export const WRAPPER = "## What's Changed";
export const CONTRIBUTORS_HEADING = "❤️ Contributors";
export const SECTION_HEADINGS = [
  ...PUBLICATION_SECTIONS.map((section) => section.heading),
  CONTRIBUTORS_HEADING,
];
const FULL_CHANGELOG = /^\*\*Full Changelog\*\*: (https:\/\/\S+)$/;
const PULL_LINK = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/;
const INLINE_AUTHOR = /^https:\/\/github\.com\/[\w.-]+\/?$/;

/**
 * Validate a release body against the canonical publication contract.
 *
 * @param {string} markdown Release body (markdown).
 * @param {{ tag?: string }} [options] Optional tag the Full Changelog must reference.
 * @returns {{ ok: boolean, errors: string[] }} Deterministic verdict.
 */
export const validateReleaseNotes = (markdown, { tag } = {}) => {
  const errors = [];
  const text = String(markdown ?? "");
  const lines = text.split("\n");
  const nonEmpty = lines
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");

  if (nonEmpty[0] !== WRAPPER)
    errors.push(`First non-empty line must be "${WRAPPER}"`);

  let lastHeading = -1;
  for (const line of nonEmpty) {
    const h3 = /^### (.+)$/.exec(line);
    if (h3) {
      const heading = h3[1].trim();
      const position = SECTION_HEADINGS.indexOf(heading);
      if (position === -1)
        errors.push(`Unknown section heading: ### ${heading}`);
      else if (position <= lastHeading)
        errors.push(`Section out of order: ### ${heading}`);
      else lastHeading = position;
      continue;
    }
    if (/^## /.test(line) && line !== WRAPPER)
      errors.push(`Unexpected level-2 heading: ${line}`);
  }

  if (/\b(?:downloads?|checksums?)\b/i.test(text))
    errors.push("Publication notes must not mention Downloads or Checksums");
  if (lines.some((line) => line.trim() === "# Release notes"))
    errors.push("Audit artifact detected: # Release notes");
  if (text.includes("— PR #")) errors.push("Audit artifact detected: — PR #");

  let inContributors = false;
  for (const line of nonEmpty) {
    if (line === WRAPPER) {
      inContributors = false;
      continue;
    }
    if (/^### /.test(line)) {
      inContributors = line === `### ${CONTRIBUTORS_HEADING}`;
      continue;
    }
    if (/^## /.test(line)) continue;
    if (FULL_CHANGELOG.test(line)) continue;
    if (inContributors) {
      if (!/^@[\w-]+$/.test(line))
        errors.push(`Contributor line must be a bare @login: ${line}`);
      continue;
    }
    if (!line.startsWith("- ")) {
      errors.push(`Content line must be a "- " bullet: ${line}`);
      continue;
    }
    for (const [, url] of line.matchAll(
      /\[[^\]]*\]\((https:\/\/github\.com\/[^)]+)\)/g,
    )) {
      if (INLINE_AUTHOR.test(url))
        errors.push(`Inline author link is not allowed in items: ${url}`);
    }
  }

  for (const [, number, url] of text.matchAll(/\[#(\d+)\]\(([^)]+)\)/g)) {
    if (!PULL_LINK.test(url) || !url.endsWith(`/pull/${number}`))
      errors.push(`Malformed pull request link for #${number}: ${url}`);
  }

  const changelogs = nonEmpty.filter((line) => FULL_CHANGELOG.test(line));
  if (changelogs.length !== 1)
    errors.push(
      `Expected exactly one **Full Changelog** line, found ${changelogs.length}`,
    );
  else {
    if (nonEmpty[nonEmpty.length - 1] !== changelogs[0])
      errors.push("**Full Changelog** must be the last non-empty line");
    if (tag && !changelogs[0].includes(tag))
      errors.push(`Full Changelog must reference ${tag}`);
  }

  return { ok: errors.length === 0, errors };
};

export const usage =
  "Usage: node scripts/validate-release-notes.mjs (--file <path> | --release vX.Y.Z) [--tag vX.Y.Z]";

export const parseArgs = (argv) => {
  const allowed = new Set(["--file", "--release", "--tag"]);
  for (const arg of argv)
    if (arg.startsWith("--") && !allowed.has(arg))
      throw new Error(`Unknown flag: ${arg}\n${usage}`);
  const value = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  for (const name of ["--file", "--release", "--tag"])
    if (argv.includes(name) && (!value(name) || value(name).startsWith("--")))
      throw new Error(`${name} requires a value`);
  const file = value("--file");
  const release = value("--release");
  const tag = value("--tag");
  if (!file && !release)
    throw new Error(`${usage}\nA --file or --release is required.`);
  if (file && release)
    throw new Error("Use either --file or --release, not both.");
  for (const [name, tagValue] of [
    ["--release", release],
    ["--tag", tag],
  ])
    if (tagValue && !/^v\d+\.\d+\.\d+$/.test(tagValue))
      throw new Error(`${name} must be a tag in vX.Y.Z format`);
  return { file, release, tag };
};

const defaultFetchReleaseBody = async (repository, tag) => {
  const { stdout } = await execFileAsync("gh", [
    "api",
    `repos/${repository}/releases/tags/${tag}`,
    "--jq",
    ".body",
  ]);
  return stdout;
};

/**
 * Run the validator. `--file` reads a local body; `--release` fetches the
 * published body through `gh api` (injectable for tests).
 *
 * @param {string[]} [argv]
 * @param {{ fetchReleaseBody?: (repository: string, tag: string) => Promise<string> }} [deps]
 * @returns {Promise<{ ok: boolean, errors: string[], source: string }>}
 */
export async function main(argv = process.argv.slice(2), deps = {}) {
  const options = parseArgs(argv);
  let markdown;
  let source;
  if (options.file) {
    source = `file:${resolve(options.file)}`;
    markdown = await readFile(resolve(options.file), "utf8");
  } else {
    const repository = process.env.GITHUB_REPOSITORY ?? "ils15/open3dcalc";
    source = `release:${options.release}`;
    const fetchBody = deps.fetchReleaseBody ?? defaultFetchReleaseBody;
    markdown = await fetchBody(repository, options.release);
  }
  const result = validateReleaseNotes(markdown, {
    tag: options.tag ?? options.release,
  });
  return { ...result, source };
}

if (import.meta.url === `file://${process.argv[1]}`)
  main()
    .then((result) => {
      if (result.ok) {
        console.log(`Release notes are valid (${result.source}).`);
        return;
      }
      for (const error of result.errors) console.error(`- ${error}`);
      process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
