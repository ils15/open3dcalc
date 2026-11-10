#!/usr/bin/env node
/**
 * Automated release preparation and guard script for Open3DCalc.
 *
 * Guarantees that releases are NEVER disorganized:
 * 1. Checks git status is clean and branch is valid.
 * 2. Resolves target SemVer (with incremental RC auto-bump).
 * 3. Runs the full QA stability battery (`verify:battery`).
 * 4. Synchronizes version across `package.json`, `package-lock.json`, and `ROADMAP.md`.
 * 5. Generates and strictly validates incremental release notes.
 * 6. Commits cleanly and creates an annotated git tag.
 *
 * Usage:
 *   node scripts/prepare-release.mjs --bump rc
 *   node scripts/prepare-release.mjs --bump patch
 *   node scripts/prepare-release.mjs --version 2.0.0-rc.12
 *   node scripts/prepare-release.mjs --dry-run
 */
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { validateReleaseNotes } from "./validate-release-notes.mjs";

const execFileAsync = promisify(execFile);

export const SEMVER_REGEX =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/;

/**
 * Parse SemVer into components.
 * @param {string} raw
 */
export function parseSemver(raw) {
  const match = String(raw).trim().match(SEMVER_REGEX);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    rc: match[4] !== undefined ? Number(match[4]) : null,
    version: `${match[1]}.${match[2]}.${match[3]}${
      match[4] !== undefined ? `-rc.${match[4]}` : ""
    }`,
    tag: `v${match[1]}.${match[2]}.${match[3]}${
      match[4] !== undefined ? `-rc.${match[4]}` : ""
    }`,
  };
}

/**
 * Compare two SemVer objects.
 * Returns > 0 if a > b, < 0 if a < b, 0 if equal.
 */
export function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  // If base versions are identical:
  // Stable release (rc === null) is greater than any RC (rc !== null)
  if (a.rc === null && b.rc !== null) return 1;
  if (a.rc !== null && b.rc === null) return -1;
  if (a.rc !== null && b.rc !== null) return a.rc - b.rc;
  return 0;
}

/**
 * Calculate the next version given a bump type.
 * @param {string} currentVersion
 * @param {'rc' | 'patch' | 'minor' | 'major'} bump
 */
export function resolveNextVersion(currentVersion, bump) {
  const current = parseSemver(currentVersion);
  if (!current) throw new Error(`Invalid current version: ${currentVersion}`);

  if (bump === "rc") {
    if (current.rc !== null) {
      return `${current.major}.${current.minor}.${current.patch}-rc.${current.rc + 1}`;
    }
    // If bumping rc from a stable release, start rc.1 of next patch
    return `${current.major}.${current.minor}.${current.patch + 1}-rc.1`;
  }

  if (bump === "patch") {
    // If currently on an RC (e.g. 2.0.0-rc.11), promoting to patch/stable produces 2.0.0
    if (current.rc !== null) {
      return `${current.major}.${current.minor}.${current.patch}`;
    }
    return `${current.major}.${current.minor}.${current.patch + 1}`;
  }

  if (bump === "minor") {
    return `${current.major}.${current.minor + 1}.0`;
  }

  if (bump === "major") {
    return `${current.major + 1}.0.0`;
  }

  throw new Error(`Unknown bump type: ${bump}`);
}

export function parseArgs(argv = process.argv.slice(2)) {
  const allowed = new Set([
    "--version",
    "--bump",
    "--dry-run",
    "--skip-battery",
    "--allow-branch",
    "--help",
  ]);

  for (const arg of argv) {
    if (arg.startsWith("--") && !allowed.has(arg)) {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  const value = (name) => {
    const idx = argv.indexOf(name);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  const isDryRun = argv.includes("--dry-run");
  const skipBattery = argv.includes("--skip-battery");
  const allowBranch = argv.includes("--allow-branch");
  const versionArg = value("--version");
  const bumpArg = value("--bump");

  return {
    isDryRun,
    skipBattery,
    allowBranch,
    versionArg,
    bumpArg,
  };
}

export async function runCommand(cmd, args, { cwd = process.cwd() } = {}) {
  const { stdout, stderr } = await execFileAsync(cmd, args, { cwd });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

export async function syncRoadmapVersion(repoRoot, targetVersion) {
  const roadmapPath = resolve(repoRoot, "ROADMAP.md");
  try {
    const content = await readFile(roadmapPath, "utf8");
    const updated = content.replace(
      /(\*\*Candidata atual no `main`:\*\*\s*`)([^`]+)(`)/,
      `$1${targetVersion}$3`,
    );
    if (content !== updated) {
      await writeFile(roadmapPath, updated, "utf8");
      return true;
    }
  } catch (err) {
    console.warn(`Warning: Could not sync ROADMAP.md: ${err.message}`);
  }
  return false;
}

export async function main(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
  const opts = parseArgs(argv);

  // 1. Read current version from package.json
  const pkgPath = resolve(cwd, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const currentParsed = parseSemver(pkg.version);
  if (!currentParsed) {
    throw new Error(`Invalid version in package.json: ${pkg.version}`);
  }

  // 2. Resolve target version
  let targetVersion;
  if (opts.versionArg) {
    const parsed = parseSemver(opts.versionArg);
    if (!parsed) {
      throw new Error(`Invalid target version specified: ${opts.versionArg}`);
    }
    targetVersion = parsed.version;
  } else if (opts.bumpArg) {
    targetVersion = resolveNextVersion(pkg.version, opts.bumpArg);
  } else {
    // Default: bump rc if currently in RC, or patch if stable
    targetVersion = resolveNextVersion(
      pkg.version,
      currentParsed.rc !== null ? "rc" : "patch",
    );
  }

  const targetParsed = parseSemver(targetVersion);
  if (!targetParsed) {
    throw new Error(`Failed to parse target version: ${targetVersion}`);
  }

  if (compareSemver(targetParsed, currentParsed) <= 0) {
    throw new Error(
      `Target version (${targetVersion}) must be strictly greater than current version (${pkg.version})`,
    );
  }

  console.log(`\n📦 Open3DCalc Release Guard`);
  console.log(`   Current: ${pkg.version}`);
  console.log(`   Target:  ${targetVersion} (${targetParsed.tag})`);
  console.log(`   Mode:    ${opts.isDryRun ? "DRY-RUN (no changes committed)" : "LIVE"}\n`);

  // 3. Git hygiene check
  const statusRes = await runCommand("git", ["status", "--porcelain"], { cwd });
  if (statusRes.stdout !== "" && !opts.isDryRun) {
    throw new Error(
      `Working tree has uncommitted changes. Please commit or stash them before cutting a release.\n${statusRes.stdout}`,
    );
  }

  const branchRes = await runCommand("git", ["branch", "--show-current"], { cwd });
  const currentBranch = branchRes.stdout;
  if (currentBranch !== "main" && !opts.allowBranch && !opts.isDryRun) {
    throw new Error(
      `Releases must be cut from 'main' (currently on '${currentBranch}'). Pass --allow-branch to override.`,
    );
  }

  // 4. Quality battery
  if (!opts.skipBattery) {
    console.log("🛡️  Running QA stability battery (verify:battery)...");
    await runCommand("npm", ["run", "verify:battery"], { cwd });
    console.log("   ✅ Battery passed: types, lint, tests, and builds clean.\n");
  } else {
    console.log("⚠️  Skipping QA stability battery as requested (--skip-battery).\n");
  }

  // 5. Release notes dry generation & incremental validation
  console.log(`📝 Generating and validating incremental release notes for ${targetParsed.tag}...`);
  const notesTmpPath = resolve(cwd, ".release-notes-preview.md");
  try {
    await runCommand(
      "node",
      [
        "scripts/release-notes.mjs",
        "--release",
        targetParsed.tag,
        "--notes-file",
        notesTmpPath,
      ],
      { cwd },
    );

    const generatedNotes = await readFile(notesTmpPath, "utf8");
    const validation = validateReleaseNotes(generatedNotes, {
      tag: targetParsed.tag,
    });

    if (!validation.ok) {
      throw new Error(
        `Generated release notes failed validation:\n${validation.errors.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
    console.log("   ✅ Release notes validated strictly (canonical format & incremental compare verified).\n");
  } finally {
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(notesTmpPath);
    } catch {
      // preview cleanup
    }
  }

  if (opts.isDryRun) {
    console.log("✨ [DRY-RUN] Release preparation succeeded. All guards passed.");
    return { ok: true, version: targetVersion, tag: targetParsed.tag, dryRun: true };
  }

  // 6. Update version in package.json & package-lock.json
  console.log(`🔄 Updating package version to ${targetVersion}...`);
  await runCommand("npm", ["version", targetVersion, "--no-git-tag-version"], {
    cwd,
  });

  // 7. Sync ROADMAP.md if applicable
  const syncedRoadmap = await syncRoadmapVersion(cwd, targetVersion);
  if (syncedRoadmap) {
    console.log("   ✅ ROADMAP.md candidate version updated.");
  }

  // 8. Stage, commit, and create tag
  console.log(`📌 Committing and tagging ${targetParsed.tag}...`);
  const filesToStage = ["package.json", "package-lock.json"];
  if (syncedRoadmap) filesToStage.push("ROADMAP.md");

  await runCommand("git", ["add", ...filesToStage], { cwd });
  await runCommand("git", ["commit", "-m", `chore(release): ${targetParsed.tag}`], {
    cwd,
  });
  await runCommand(
    "git",
    ["tag", "-a", targetParsed.tag, "-m", `Release ${targetParsed.tag}`],
    { cwd },
  );

  const commitRes = await runCommand("git", ["rev-parse", "--short", "HEAD"], {
    cwd,
  });

  console.log(`\n=======================================================`);
  console.log(`🎉 Release ${targetParsed.tag} prepared successfully!`);
  console.log(`=======================================================`);
  console.log(`• Commit: ${commitRes.stdout} chore(release): ${targetParsed.tag}`);
  console.log(`• Tag:    ${targetParsed.tag}`);
  console.log(`\nTo publish:`);
  console.log(`  git push origin ${currentBranch}`);
  console.log(`  git push origin ${targetParsed.tag}`);
  console.log(`=======================================================\n`);

  return { ok: true, version: targetVersion, tag: targetParsed.tag, dryRun: false };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`\n❌ Release preparation failed:\n${err.message}\n`);
    process.exitCode = 1;
  });
}
