import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/beta-deploy.yml"),
  "utf8",
);
const integrityScript = workflow.match(
  /# Treat the downloaded artifact as untrusted\.[^\n]*\n\s*# verifies its exact contents without loading or executing project code\.\n\s*node --input-type=module <<'NODE'\n([\s\S]*?)\n\s*NODE/m,
)?.[1];
const publicationStepStart = workflow.indexOf(
  "      - name: Publish beta site and prerelease\n",
);
const publicationStep = workflow.slice(publicationStepStart);
const publicationScript = (() => {
  const runMarker = "        run: |\n";
  const runStart = publicationStep.indexOf(runMarker);
  if (publicationStepStart < 0 || runStart < 0) return undefined;

  const scriptLines: string[] = [];
  for (const line of publicationStep
    .slice(runStart + runMarker.length)
    .split("\n")) {
    if (line.length === 0) {
      scriptLines.push("");
    } else if (line.startsWith("          ")) {
      scriptLines.push(line.slice(10));
    } else {
      break;
    }
  }
  return scriptLines.join("\n");
})();

const betaTag = "v2.0.0-beta.30";
const newSiteContent = "published beta index\n";

function runCommand(command: string, args: string[], cwd?: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status}): ${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

function runGit(args: string[], cwd?: string) {
  return runCommand("git", args, cwd);
}

function createBareRepository(
  root: string,
  options: { seed?: boolean; betaSymlink?: boolean },
) {
  const githubRoot = join(root, "github");
  const repositoryDirectory = join(githubRoot, "owner");
  const bareRepository = join(repositoryDirectory, "repo.git");
  mkdirSync(repositoryDirectory, { recursive: true });
  runGit([
    "init",
    "--bare",
    "--quiet",
    "--initial-branch=gh-pages",
    bareRepository,
  ]);

  if (options.seed) {
    const seedDirectory = join(root, "seed");
    mkdirSync(seedDirectory);
    runGit(["init", "--quiet", "--initial-branch=gh-pages", seedDirectory]);
    runGit(["config", "user.name", "Beta deploy test"], seedDirectory);
    runGit(
      ["config", "user.email", "beta-deploy-test@example.invalid"],
      seedDirectory,
    );
    writeFileSync(join(seedDirectory, "keep.txt"), "unrelated branch file\n");
    if (options.betaSymlink) {
      symlinkSync("keep.txt", join(seedDirectory, "beta"));
    } else {
      mkdirSync(join(seedDirectory, "beta"));
      writeFileSync(join(seedDirectory, "beta", "old.html"), "old beta site\n");
    }
    runGit(["add", "--all"], seedDirectory);
    runGit(["commit", "--quiet", "-m", "seed gh-pages"], seedDirectory);
    runGit(["remote", "add", "origin", bareRepository], seedDirectory);
    runGit(
      ["push", "--quiet", "origin", "HEAD:refs/heads/gh-pages"],
      seedDirectory,
    );
  }

  return { bareRepository, githubRoot };
}

function runPublication(options: {
  seed?: boolean;
  betaSymlink?: boolean;
  rejectPush?: boolean;
  releaseExists?: boolean;
}) {
  expect(publicationScript, "missing inline publication script").toBeDefined();
  const root = mkdtempSync(join(tmpdir(), "open3dcalc-beta-publish-"));
  const workspace = join(root, "workspace");
  const binaryDirectory = join(root, "bin");
  const siteDirectory = join(workspace, "beta-artifact", "dist-web");
  const releaseLog = join(root, "release.log");

  try {
    mkdirSync(siteDirectory, { recursive: true });
    mkdirSync(binaryDirectory);
    writeFileSync(join(siteDirectory, "index.html"), newSiteContent);
    writeFileSync(join(siteDirectory, "404.html"), "not found\n");
    writeFileSync(
      join(workspace, "beta-artifact", "beta-notes.md"),
      "release notes\n",
    );

    const { bareRepository, githubRoot } = createBareRepository(root, options);
    if (options.rejectPush) {
      writeFileSync(
        join(bareRepository, "hooks", "pre-receive"),
        "#!/bin/sh\nexit 1\n",
        {
          mode: 0o755,
        },
      );
    }

    writeFileSync(
      join(binaryDirectory, "gh"),
      `#!/bin/sh
set -eu
assert_published() {
  git --git-dir="$TEST_BARE_REPOSITORY" show refs/heads/gh-pages:beta/index.html |
    grep -Fxq "$TEST_SITE_CONTENT" || exit 90
  if [ "$TEST_KEEP_FILE" = 1 ]; then
    git --git-dir="$TEST_BARE_REPOSITORY" show refs/heads/gh-pages:keep.txt |
      grep -Fxq 'unrelated branch file' || exit 91
  fi
}
case "$1/$2" in
  release/view)
    assert_published
    printf 'view\\n' >> "$TEST_RELEASE_LOG"
    [ "$TEST_RELEASE_EXISTS" = 1 ]
    ;;
  release/edit|release/create)
    assert_published
    printf '%s\\n' "$2" >> "$TEST_RELEASE_LOG"
    ;;
  *) exit 92 ;;
esac
`,
      { mode: 0o755 },
    );

    const env = {
      ...process.env,
      PATH: `${binaryDirectory}:${process.env.PATH ?? "/usr/bin:/bin"}`,
      GH_TOKEN: "test-write-token-must-not-be-logged",
      BETA_TAG: betaTag,
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_SERVER_URL: `file://${githubRoot}`,
      GITHUB_WORKSPACE: workspace,
      RUNNER_TEMP: root,
      TEST_BARE_REPOSITORY: bareRepository,
      TEST_RELEASE_LOG: releaseLog,
      TEST_RELEASE_EXISTS: options.releaseExists ? "1" : "0",
      TEST_KEEP_FILE: options.seed ? "1" : "0",
      TEST_SITE_CONTENT: newSiteContent.trimEnd(),
    };
    const result = spawnSync("bash", ["-c", publicationScript!], {
      cwd: workspace,
      encoding: "utf8",
      env,
    });

    return { result, bareRepository, releaseLog, root };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

function runArtifactIntegrityCheck(
  options: {
    changeCommitSha?: boolean;
    changeHash?: boolean;
    addExtraFile?: boolean;
  } = {},
) {
  expect(
    integrityScript,
    "missing standalone artifact integrity validator",
  ).toBeDefined();
  const tempDirectory = mkdtempSync(
    join(tmpdir(), "open3dcalc-beta-integrity-"),
  );
  const artifactDirectory = join(tempDirectory, "beta-artifact");
  const siteDirectory = join(artifactDirectory, "dist-web");
  const tag = "v2.0.0-beta.30";
  const commitSha = "a".repeat(40);
  const contents = [
    { path: "beta-notes.md", content: "Beta notes\n" },
    { path: "dist-web/404.html", content: "Not found\n" },
    { path: "dist-web/index.html", content: "<html>beta</html>\n" },
  ];

  try {
    mkdirSync(siteDirectory, { recursive: true });
    for (const file of contents) {
      writeFileSync(join(artifactDirectory, file.path), file.content);
    }
    const files = contents
      .map(({ path, content }) => ({
        path,
        sha256: createHash("sha256").update(content).digest("hex"),
      }))
      .sort((left, right) => (left.path < right.path ? -1 : 1));
    if (options.changeHash) files[0]!.sha256 = "0".repeat(64);
    const metadata = {
      schemaVersion: 1,
      commitSha: options.changeCommitSha ? "b".repeat(40) : commitSha,
      betaVersion: tag.slice(1),
      betaTag: tag,
      files,
    };
    writeFileSync(
      join(artifactDirectory, "beta-build-metadata.json"),
      `${JSON.stringify(metadata)}\n`,
    );
    if (options.addExtraFile) {
      writeFileSync(join(siteDirectory, "unexpected.txt"), "unmanifested\n");
    }

    return spawnSync(process.execPath, ["--input-type=module", "-"], {
      cwd: tempDirectory,
      encoding: "utf8",
      env: { BETA_TAG: tag, GITHUB_SHA: commitSha },
      input: integrityScript,
    });
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function jobBlock(name: string, nextName: string) {
  const start = workflow.indexOf(`  ${name}:\n`);
  const end = workflow.indexOf(`  ${nextName}:\n`, start + 1);
  expect(start, `missing ${name} job`).toBeGreaterThanOrEqual(0);
  expect(end, `missing ${nextName} job`).toBeGreaterThan(start);
  return workflow.slice(start, end);
}

function jobCondition(block: string) {
  const expression = block.match(/^ {4}if: >-\n((?: {6}.+\n)+)/m)?.[1];
  expect(expression, "missing folded job condition").toBeDefined();
  return expression!
    .split("\n")
    .map((line) => line.trim())
    .join(" ")
    .trim();
}

describe("beta hosted preview workflow invariants", () => {
  const build = jobBlock("build-beta", "deploy-beta");
  const deploy = workflow.slice(workflow.indexOf("  deploy-beta:\n"));

  it("keeps tag publication and allows only main dispatches to build previews", () => {
    expect(workflow).toMatch(/^ {2}workflow_dispatch:\s*$/m);
    expect(workflow).toMatch(/tags:\n\s+- "v\*-beta\.\*"/);
    expect(workflow).toContain(
      "group: ${{ github.event_name == 'workflow_dispatch' && 'beta-preview' || 'gh-pages-deploy' }}",
    );
    expect(jobCondition(build)).toBe(
      "(github.event_name == 'push' && github.ref_type == 'tag' && startsWith(github.ref, 'refs/tags/v') && contains(github.ref, '-beta.')) || (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main')",
    );
    expect(build).toContain('if [ "$GITHUB_REF" != refs/heads/main ]');
    expect(build).toContain("refs/heads/main:refs/remotes/origin/main");
    expect(build).toContain(
      'git ls-remote --refs origin "refs/tags/$BETA_TAG"',
    );
  });

  it("makes dispatch incapable of reaching deployment or its credentials", () => {
    expect(workflow).toMatch(/^permissions: \{\}$/m);
    expect(build).toContain("permissions:\n      contents: read");
    expect(build).not.toMatch(
      /environment:|secrets\.|BETA_RELEASE_TOKEN|gh-pages|peaceiris/,
    );
    expect(deploy).toContain("needs: build-beta");
    expect(jobCondition(deploy)).toBe(
      "needs.build-beta.result == 'success' && github.event_name == 'push' && github.ref_type == 'tag' && startsWith(github.ref, 'refs/tags/v') && contains(github.ref, '-beta.')",
    );
    expect(deploy).toContain("environment: beta-release");
    expect(deploy).toContain("name: beta-site");
  });

  it("uploads an isolated preview artifact with comparable bundle metadata", () => {
    expect(build).toContain(
      "name: ${{ github.event_name == 'workflow_dispatch' && 'beta-site-preview' || 'beta-site' }}",
    );
    expect(build).toContain("beta-artifact/beta-build-metadata.json");
    expect(build).toContain("commitSha: sha");
    expect(build).toContain("betaVersion: tag.slice(1)");
    expect(build).toContain("betaTag: tag");
    expect(build).toContain("createHash('sha256')");
    expect(build).toContain("VITE_BETA_CHANNEL=true");
    expect(build).toContain("VITE_TOOLPATH_PREVIEW=true");
    expect(build).toContain(
      "mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27",
    );
  });

  it("accepts a matching artifact manifest and rejects changed or extra content", () => {
    expect(runArtifactIntegrityCheck().status).toBe(0);
    expect(runArtifactIntegrityCheck({ changeHash: true }).status).not.toBe(0);
    expect(runArtifactIntegrityCheck({ addExtraFile: true }).status).not.toBe(
      0,
    );
    expect(
      runArtifactIntegrityCheck({ changeCommitSha: true }).status,
    ).not.toBe(0);
  });

  it("uses one token-bearing final publication step after all validation", () => {
    const integrityCheck = deploy.indexOf("- name: Verify artifact metadata");
    const publicRefCheck = deploy.indexOf('api_get "git/ref/tags/$BETA_TAG"');
    const tokenUse = deploy.indexOf(
      "GH_TOKEN: ${{ secrets.BETA_RELEASE_TOKEN }}",
    );
    const tokenUseCount = [...workflow.matchAll(/secrets\.BETA_RELEASE_TOKEN/g)]
      .length;

    expect(integrityCheck).toBeGreaterThanOrEqual(0);
    expect(deploy).toMatch(/permissions: \{\}/);
    expect(deploy).not.toContain("contents: write");
    expect(publicRefCheck).toBeGreaterThan(integrityCheck);
    expect(tokenUseCount).toBe(1);
    expect(tokenUse).toBeGreaterThan(publicRefCheck);
    expect(deploy.slice(0, publicRefCheck)).not.toContain("secrets.");
    expect(deploy).not.toContain("secrets.GITHUB_TOKEN");
    expect(deploy).not.toContain("peaceiris/actions-gh-pages");
    expect(deploy).toContain("Publish beta site and prerelease");
    expect(deploy.lastIndexOf("- name:")).toBe(
      deploy.indexOf("- name: Publish beta site and prerelease"),
    );
    expect(deploy).toContain('GIT_ASKPASS="$askpass"');
    expect(deploy.indexOf('git -C "$publish_repo" push')).toBeLessThan(
      deploy.indexOf('gh release view "$BETA_TAG"'),
    );
    expect(deploy.slice(integrityCheck, tokenUse)).not.toContain("secrets.");
    expect(deploy).not.toMatch(/uses: actions\/checkout|npm (ci|install|run)/);
    expect(publicationScript).toBeDefined();
  });

  it("updates only beta on gh-pages and edits the release after push", () => {
    const outcome = runPublication({ seed: true, releaseExists: true });
    try {
      expect(outcome.result.status).toBe(0);
      expect(
        runGit([
          "--git-dir",
          outcome.bareRepository,
          "show",
          "refs/heads/gh-pages:keep.txt",
        ]),
      ).toBe("unrelated branch file");
      expect(
        runGit([
          "--git-dir",
          outcome.bareRepository,
          "show",
          "refs/heads/gh-pages:beta/index.html",
        ]),
      ).toBe(newSiteContent.trimEnd());
      expect(
        runGit([
          "--git-dir",
          outcome.bareRepository,
          "diff-tree",
          "--no-commit-id",
          "--name-only",
          "-r",
          "refs/heads/gh-pages",
        ]).split("\n"),
      ).toEqual(["beta/404.html", "beta/index.html", "beta/old.html"]);
      expect(
        spawnSync(
          "git",
          [
            "--git-dir",
            outcome.bareRepository,
            "show",
            "refs/heads/gh-pages:beta/old.html",
          ],
          { encoding: "utf8" },
        ).status,
      ).not.toBe(0);
      expect(readFileSync(outcome.releaseLog, "utf8")).toBe("view\nedit\n");
      expect(`${outcome.result.stdout}${outcome.result.stderr}`).not.toContain(
        "test-write-token-must-not-be-logged",
      );
    } finally {
      rmSync(outcome.root, { recursive: true, force: true });
    }
  });

  it("creates gh-pages and the prerelease when both are missing", () => {
    const outcome = runPublication({ releaseExists: false });
    try {
      expect(outcome.result.status).toBe(0);
      expect(
        runGit([
          "--git-dir",
          outcome.bareRepository,
          "show",
          "refs/heads/gh-pages:beta/index.html",
        ]),
      ).toBe(newSiteContent.trimEnd());
      expect(readFileSync(outcome.releaseLog, "utf8")).toBe("view\ncreate\n");
    } finally {
      rmSync(outcome.root, { recursive: true, force: true });
    }
  });

  it("rejects a beta symlink and never creates a release if the site push fails", () => {
    const symlinkOutcome = runPublication({ seed: true, betaSymlink: true });
    try {
      expect(symlinkOutcome.result.status).not.toBe(0);
      expect(symlinkOutcome.result.stderr).toContain(
        "gh-pages/beta is a symlink",
      );
      expect(existsSync(symlinkOutcome.releaseLog)).toBe(false);
    } finally {
      rmSync(symlinkOutcome.root, { recursive: true, force: true });
    }

    const rejectedPush = runPublication({ seed: true, rejectPush: true });
    try {
      expect(rejectedPush.result.status).not.toBe(0);
      expect(existsSync(rejectedPush.releaseLog)).toBe(false);
    } finally {
      rmSync(rejectedPush.root, { recursive: true, force: true });
    }
  });
});
