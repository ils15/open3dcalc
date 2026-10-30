import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(process.cwd());
const hostedHook = readFileSync(
  join(projectRoot, "scripts/hosted-pre-commit.sh"),
  "utf8",
);
const hostedGitleaksScanner = readFileSync(
  join(projectRoot, "scripts/scan-hosted-gitleaks.sh"),
  "utf8",
);
const preCommitHook = readFileSync(
  join(projectRoot, ".husky/pre-commit"),
  "utf8",
);
const gitleaksConfig = readFileSync(
  join(projectRoot, ".gitleaks.toml"),
  "utf8",
);
const betaWorkflow = readFileSync(
  join(projectRoot, ".github/workflows/beta.yml"),
  "utf8",
);

function runGit(args: string[], cwd: string) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function installedGitleaks() {
  const version = spawnSync("gitleaks", ["version"], { encoding: "utf8" });
  expect(version.status).toBe(0);
  expect(version.stdout).toContain("8.30.1");
  const binary = spawnSync("sh", ["-c", "command -v gitleaks"], {
    encoding: "utf8",
  });
  expect(binary.status).toBe(0);
  return binary.stdout.trim();
}

function failGitWorktreeOperation(
  binaryDirectory: string,
  operation: "add" | "remove",
) {
  const git = spawnSync("sh", ["-c", "command -v git"], {
    encoding: "utf8",
  });
  if (git.status !== 0) {
    throw new Error("git executable is unavailable for the fixture");
  }
  writeFileSync(
    join(binaryDirectory, "git"),
    `#!/bin/sh\nprevious=\nfor arg do\n  if [ "$previous" = worktree ] && [ "$arg" = ${operation} ]; then\n    echo 'forced git worktree ${operation} failure' >&2\n    exit 81\n  fi\n  previous=$arg\ndone\nexec "${git.stdout.trim()}" "$@"\n`,
    { mode: 0o755 },
  );
}

function syntheticGitHubToken() {
  return ["gh", "p_", "AbCd1234EfGh5678IjKl", "9012MnOp3456QrSt"].join("");
}

function createLocalPreCommitFixture(options: { trackIgnore?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), "open3dcalc-local-hook-test-"));
  const repository = join(root, "repo");
  const candidatePath = "scripts/__tests__/local-secret-fixture.txt";
  const unstagedPath = "scripts/__tests__/local-unstaged-fixture.txt";
  const token = syntheticGitHubToken();

  try {
    mkdirSync(repository);
    mkdirSync(join(repository, ".husky"));
    mkdirSync(join(repository, "scripts", "__tests__"), { recursive: true });
    runGit(["init", "--quiet", "--initial-branch=main"], repository);
    runGit(["config", "user.name", "Local hook test"], repository);
    runGit(
      ["config", "user.email", "local-hook-test@example.invalid"],
      repository,
    );
    writeFileSync(join(repository, ".gitleaks.toml"), gitleaksConfig);
    writeFileSync(join(repository, ".husky/pre-commit"), preCommitHook);
    writeFileSync(join(repository, "README.md"), "base\n");
    runGit(["add", "--all"], repository);
    runGit(["commit", "--quiet", "-m", "base"], repository);

    writeFileSync(
      join(repository, candidatePath),
      `const token = "${token}";\n`,
    );
    writeFileSync(join(repository, unstagedPath), "const clean = true;\n");
    runGit(["add", candidatePath, unstagedPath], repository);
    const report = spawnSync(
      installedGitleaks(),
      [
        "git",
        "--config",
        join(repository, ".gitleaks.toml"),
        "--pre-commit",
        "--staged",
        "--redact=100",
        "--no-banner",
        "--report-format",
        "json",
        "--report-path",
        "-",
      ],
      { cwd: repository, encoding: "utf8" },
    );
    if (report.status !== 1) {
      throw new Error(
        `Gitleaks did not find the runtime-assembled test token: ${report.stderr}`,
      );
    }
    const fingerprint = JSON.parse(report.stdout)[0]?.Fingerprint;
    if (typeof fingerprint !== "string") {
      throw new Error("Gitleaks report did not include a finding fingerprint.");
    }
    writeFileSync(join(repository, ".gitleaksignore"), `${fingerprint}\n`);
    if (options.trackIgnore) {
      runGit(["add", ".gitleaksignore"], repository);
    } else {
      expect(runGit(["status", "--short"], repository)).toContain(
        "?? .gitleaksignore",
      );
    }

    return {
      root,
      repository,
      candidatePath,
      unstagedPath,
      token,
      fingerprint,
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

function createLocalCleanHookFixture() {
  const root = mkdtempSync(join(tmpdir(), "open3dcalc-clean-hook-test-"));
  const repository = join(root, "repo");
  const binaryDirectory = join(root, "bin");

  try {
    mkdirSync(repository);
    mkdirSync(binaryDirectory);
    mkdirSync(join(repository, ".husky"));
    runGit(["init", "--quiet", "--initial-branch=main"], repository);
    runGit(["config", "user.name", "Clean hook test"], repository);
    runGit(
      ["config", "user.email", "clean-hook-test@example.invalid"],
      repository,
    );
    writeFileSync(join(repository, ".gitleaks.toml"), gitleaksConfig);
    writeFileSync(join(repository, ".husky/pre-commit"), preCommitHook);
    writeFileSync(join(repository, "README.md"), "base\n");
    runGit(["add", "--all"], repository);
    runGit(["commit", "--quiet", "-m", "base"], repository);
    writeFileSync(join(repository, "candidate.txt"), "const clean = true;\n");
    runGit(["add", "candidate.txt"], repository);
    writeFileSync(join(binaryDirectory, "node"), "#!/bin/sh\nexit 0\n", {
      mode: 0o755,
    });
    writeFileSync(join(binaryDirectory, "npx"), "#!/bin/sh\nexit 0\n", {
      mode: 0o755,
    });

    const env = { ...process.env };
    delete env.GITLEAKS_CONFIG;
    delete env.GITLEAKS_CONFIG_TOML;
    delete env.SKIP_GITLEAKS;
    Object.assign(env, {
      PATH: `${binaryDirectory}:${process.env.PATH ?? "/usr/bin:/bin"}`,
      TMPDIR: root,
    });
    return { root, repository, env };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

function createHostedHookFixture(options: {
  baseConfig?: string;
  candidateFile: string;
  candidatePath?: string;
  candidateConfig?: string;
  hook?: string;
}) {
  const root = mkdtempSync(join(tmpdir(), "open3dcalc-hosted-hook-test-"));
  const repository = join(root, "repo");
  const binaryDirectory = join(root, "bin");
  const observationFile = join(root, "gitleaks-observation");
  const realGitleaks = installedGitleaks();

  try {
    mkdirSync(repository);
    mkdirSync(binaryDirectory);
    runGit(["init", "--quiet", "--initial-branch=main"], repository);
    runGit(["config", "user.name", "Hosted hook test"], repository);
    runGit(
      ["config", "user.email", "hosted-hook-test@example.invalid"],
      repository,
    );
    mkdirSync(join(repository, ".husky"));
    mkdirSync(join(repository, "scripts"));
    writeFileSync(join(repository, ".gitignore"), "/node_modules/\n");
    writeFileSync(join(repository, ".husky/pre-commit"), preCommitHook);
    writeFileSync(join(repository, "scripts/hosted-pre-commit.sh"), hostedHook);
    writeFileSync(
      join(repository, "scripts/scan-hosted-gitleaks.sh"),
      hostedGitleaksScanner,
    );
    writeFileSync(
      join(repository, ".gitleaks.toml"),
      options.baseConfig ?? gitleaksConfig,
    );
    writeFileSync(join(repository, "README.md"), "base\n");
    runGit(["add", "--all"], repository);
    runGit(["commit", "--quiet", "-m", "base"], repository);
    const baseSha = runGit(["rev-parse", "HEAD"], repository);
    const baseConfig = spawnSync("git", ["show", `${baseSha}:.gitleaks.toml`], {
      cwd: repository,
      encoding: "utf8",
    });
    if (baseConfig.status !== 0) {
      throw new Error(`git show base config failed: ${baseConfig.stderr}`);
    }
    const hardenedBaseConfig = baseConfig.stdout.replace(
      /^.*scripts\/__tests__\/.*(?:\r?\n|$)/gm,
      "",
    );
    mkdirSync(join(repository, "node_modules"));

    const candidatePath =
      options.candidatePath ?? "src/hosted-hook-fixture.txt";
    const candidateFile = join(repository, candidatePath);
    mkdirSync(dirname(candidateFile), { recursive: true });
    writeFileSync(candidateFile, options.candidateFile);
    if (options.candidateConfig !== undefined) {
      writeFileSync(
        join(repository, ".gitleaks.toml"),
        options.candidateConfig,
      );
    }
    if (options.hook !== undefined) {
      writeFileSync(join(repository, ".husky/pre-commit"), options.hook);
    }
    runGit(["add", "--all"], repository);
    runGit(["commit", "--quiet", "-m", "candidate"], repository);
    const candidateSha = runGit(["rev-parse", "HEAD"], repository);
    const candidateTree = runGit(
      ["rev-parse", `${candidateSha}^{tree}`],
      repository,
    );

    writeFileSync(
      join(binaryDirectory, "gitleaks"),
      `#!/bin/sh
pre_commit=no
staged=no
config_path=
expect_config=no
for arg do
  [ "$arg" = --pre-commit ] && pre_commit=yes
  [ "$arg" = --staged ] && staged=yes
  if [ "$expect_config" = yes ]; then
    config_path=$arg
    expect_config=no
  elif [ "$arg" = --config ]; then
    expect_config=yes
  fi
done
if [ "$1" = git ] && [ "$pre_commit" = yes ] && [ "$staged" = yes ]; then
  head=$(git rev-parse HEAD)
  index=$(git write-tree)
  if git diff --cached --quiet "$GATE_BASE_SHA" --; then staged=empty; else staged=present; fi
  config_sha=$(sha256sum "$config_path" | cut -d ' ' -f 1)
  printf 'HEAD=%s\\nINDEX_TREE=%s\\nSTAGED=%s\\nCONFIG_SHA=%s\\n' \\
    "$head" "$index" "$staged" "$config_sha" > "$GITLEAKS_OBSERVATION"
fi
exec "$REAL_GITLEAKS" "$@"
`,
      { mode: 0o755 },
    );
    writeFileSync(join(binaryDirectory, "node"), "#!/bin/sh\nexit 0\n", {
      mode: 0o755,
    });
    writeFileSync(join(binaryDirectory, "npx"), "#!/bin/sh\nexit 0\n", {
      mode: 0o755,
    });

    const env = { ...process.env };
    delete env.GIT_INDEX_FILE;
    delete env.GITLEAKS_CONFIG;
    delete env.GITLEAKS_CONFIG_TOML;
    Object.assign(env, {
      PATH: `${binaryDirectory}:${process.env.PATH ?? "/usr/bin:/bin"}`,
      REAL_GITLEAKS: realGitleaks,
      GITLEAKS_OBSERVATION: observationFile,
      GATE_BASE_SHA: baseSha,
      CANDIDATE_SHA: candidateSha,
      TMPDIR: root,
    });
    return {
      root,
      repository,
      env,
      baseSha,
      candidateSha,
      candidateTree,
      trustedConfigSha256: createHash("sha256")
        .update(hardenedBaseConfig)
        .digest("hex"),
      candidatePath,
      observationFile,
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

function runHostedHook(fixture: ReturnType<typeof createHostedHookFixture>) {
  return spawnSync("bash", ["scripts/hosted-pre-commit.sh"], {
    cwd: fixture.repository,
    encoding: "utf8",
    env: fixture.env,
  });
}

function runHostedGitleaks(
  fixture: ReturnType<typeof createHostedHookFixture>,
) {
  return spawnSync("bash", ["scripts/scan-hosted-gitleaks.sh"], {
    cwd: fixture.repository,
    encoding: "utf8",
    env: fixture.env,
  });
}

function refreshHostedCandidate(
  fixture: ReturnType<typeof createHostedHookFixture>,
) {
  fixture.candidateSha = runGit(["rev-parse", "HEAD"], fixture.repository);
  fixture.candidateTree = runGit(
    ["rev-parse", `${fixture.candidateSha}^{tree}`],
    fixture.repository,
  );
  fixture.env.CANDIDATE_SHA = fixture.candidateSha;
}

describe("mandatory pre-commit Gitleaks scan", () => {
  it("rejects SKIP_GITLEAKS instead of bypassing the scan", () => {
    const result = spawnSync("sh", [".husky/pre-commit"], {
      encoding: "utf8",
      env: { ...process.env, SKIP_GITLEAKS: "1" },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SKIP_GITLEAKS não é permitido");
  });

  it.each(["GITLEAKS_CONFIG", "GITLEAKS_CONFIG_TOML"])(
    "rejects the %s environment override",
    (override) => {
      const fixture = createHostedHookFixture({
        candidateFile: "const clean = true;\n",
      });

      try {
        fixture.env[override] = "";
        const result = runHostedHook(fixture);

        expect(result.status).not.toBe(0);
        expect(`${result.stdout}${result.stderr}`).toContain(
          `${override} não é permitido`,
        );
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    },
  );

  it("rejects a staged secret despite a matching untracked .gitleaksignore", () => {
    const fixture = createLocalPreCommitFixture();

    try {
      const env = { ...process.env };
      delete env.GITLEAKS_CONFIG;
      delete env.GITLEAKS_CONFIG_TOML;
      delete env.SKIP_GITLEAKS;
      const result = spawnSync("sh", [".husky/pre-commit"], {
        cwd: fixture.repository,
        encoding: "utf8",
        env,
      });
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain(fixture.candidatePath);
      expect(output).toContain("Gitleaks falhou; commit bloqueado");
      expect(output).not.toContain(fixture.token);
      expect(
        readFileSync(join(fixture.repository, ".gitleaksignore"), "utf8"),
      ).toBe(`${fixture.fingerprint}\n`);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("scans the staged tree, ignores unstaged edits, and excludes a staged .gitleaksignore", () => {
    const fixture = createLocalPreCommitFixture({ trackIgnore: true });

    try {
      writeFileSync(
        join(fixture.repository, fixture.candidatePath),
        "const clean = true;\n",
      );
      writeFileSync(
        join(fixture.repository, fixture.unstagedPath),
        `const unstagedToken = "${fixture.token}";\n`,
      );
      const env = { ...process.env, TMPDIR: fixture.root };
      delete env.GITLEAKS_CONFIG;
      delete env.GITLEAKS_CONFIG_TOML;
      delete env.SKIP_GITLEAKS;
      const result = spawnSync("sh", [".husky/pre-commit"], {
        cwd: fixture.repository,
        encoding: "utf8",
        env,
      });
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain(fixture.candidatePath);
      expect(output).not.toContain(fixture.unstagedPath);
      expect(output).not.toContain(fixture.token);
      expect(output).toContain("Gitleaks falhou; commit bloqueado");
      expect(
        readFileSync(join(fixture.repository, ".gitleaksignore"), "utf8"),
      ).toBe(`${fixture.fingerprint}\n`);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("uses Git's active alternate index for the staged snapshot", () => {
    const fixture = createLocalPreCommitFixture();
    const alternateIndex = join(fixture.root, "alternate-index");

    try {
      copyFileSync(join(fixture.repository, ".git/index"), alternateIndex);
      runGit(["read-tree", "HEAD"], fixture.repository);
      const headTree = runGit(["rev-parse", "HEAD^{tree}"], fixture.repository);
      expect(runGit(["write-tree"], fixture.repository)).toBe(headTree);
      const stagedTree = spawnSync("git", ["write-tree"], {
        cwd: fixture.repository,
        encoding: "utf8",
        env: { ...process.env, GIT_INDEX_FILE: alternateIndex },
      });
      expect(stagedTree.status).toBe(0);
      expect(stagedTree.stdout.trim()).not.toBe(headTree);

      const env = {
        ...process.env,
        GIT_INDEX_FILE: alternateIndex,
        TMPDIR: fixture.root,
      };
      delete env.GITLEAKS_CONFIG;
      delete env.GITLEAKS_CONFIG_TOML;
      delete env.SKIP_GITLEAKS;
      const result = spawnSync("sh", [".husky/pre-commit"], {
        cwd: fixture.repository,
        encoding: "utf8",
        env,
      });
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain(fixture.candidatePath);
      expect(output).not.toContain(fixture.token);
      expect(output).toContain("Gitleaks falhou; commit bloqueado");
      expect(runGit(["write-tree"], fixture.repository)).toBe(headTree);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("runs a clean normal hook through lint-staged and removes its disposable worktree", () => {
    const fixture = createLocalCleanHookFixture();

    try {
      const result = spawnSync("sh", [".husky/pre-commit"], {
        cwd: fixture.repository,
        encoding: "utf8",
        env: fixture.env,
      });

      expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("Running lint-staged");
      expect(readdirSync(fixture.root).sort()).toEqual(["bin", "repo"]);
      expect(
        runGit(["worktree", "list", "--porcelain"], fixture.repository)
          .split("\n")
          .filter((line) => line.startsWith("worktree ")),
      ).toEqual([`worktree ${fixture.repository}`]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("fails closed when the local disposable worktree cannot be created", () => {
    const fixture = createLocalCleanHookFixture();
    const binaryDirectory = join(fixture.root, "bin");

    try {
      failGitWorktreeOperation(binaryDirectory, "add");
      const result = spawnSync("sh", [".husky/pre-commit"], {
        cwd: fixture.repository,
        encoding: "utf8",
        env: fixture.env,
      });

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain(
        "Não foi possível criar o worktree descartável",
      );
      expect(readdirSync(fixture.root).sort()).toEqual(["bin", "repo"]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("fails closed when local snapshot cleanup fails after a clean scan", () => {
    const fixture = createLocalCleanHookFixture();
    const binaryDirectory = join(fixture.root, "bin");

    try {
      failGitWorktreeOperation(binaryDirectory, "remove");
      const result = spawnSync("sh", [".husky/pre-commit"], {
        cwd: fixture.repository,
        encoding: "utf8",
        env: fixture.env,
      });

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain(
        "Não foi possível remover o worktree descartável",
      );
      expect(
        readdirSync(fixture.root).some((entry) =>
          entry.startsWith("open3dcalc-gitleaks."),
        ),
      ).toBe(true);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("cleans up the disposable worktree after the Gitleaks process is interrupted", () => {
    const fixture = createLocalPreCommitFixture();
    const binaryDirectory = join(fixture.root, "bin");

    try {
      mkdirSync(binaryDirectory);
      writeFileSync(
        join(binaryDirectory, "gitleaks"),
        '#!/bin/sh\nkill -TERM "$PPID"\nexit 0\n',
        { mode: 0o755 },
      );
      const env = { ...process.env, TMPDIR: fixture.root };
      delete env.GITLEAKS_CONFIG;
      delete env.GITLEAKS_CONFIG_TOML;
      delete env.SKIP_GITLEAKS;
      Object.assign(env, {
        PATH: `${binaryDirectory}:${process.env.PATH ?? "/usr/bin:/bin"}`,
      });
      const result = spawnSync("sh", [".husky/pre-commit"], {
        cwd: fixture.repository,
        encoding: "utf8",
        env,
      });

      expect(result.status).not.toBe(0);
      expect(
        readFileSync(join(fixture.repository, ".gitleaksignore"), "utf8"),
      ).toBe(`${fixture.fingerprint}\n`);
      expect(
        readdirSync(fixture.root).filter((entry) =>
          entry.startsWith("open3dcalc-gitleaks."),
        ),
      ).toEqual([]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("fails closed when Gitleaks is absent", () => {
    const emptyPath = mkdtempSync(join(tmpdir(), "open3dcalc-no-gitleaks-"));

    try {
      const env = { ...process.env, PATH: emptyPath };
      delete env.SKIP_GITLEAKS;
      const result = spawnSync("/bin/sh", [".husky/pre-commit"], {
        encoding: "utf8",
        env,
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("gitleaks não instalado");
    } finally {
      rmSync(emptyPath, { recursive: true, force: true });
    }
  });

  it("fails closed when the Gitleaks scan returns an error", () => {
    const binDirectory = mkdtempSync(
      join(tmpdir(), "open3dcalc-failing-gitleaks-"),
    );

    try {
      writeFileSync(join(binDirectory, "gitleaks"), "#!/bin/sh\nexit 23\n", {
        mode: 0o755,
      });
      const env = {
        ...process.env,
        PATH: `${binDirectory}:${process.env.PATH ?? "/usr/bin:/bin"}`,
      };
      delete env.SKIP_GITLEAKS;
      const result = spawnSync("sh", [".husky/pre-commit"], {
        encoding: "utf8",
        env,
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Gitleaks falhou; commit bloqueado");
    } finally {
      rmSync(binDirectory, { recursive: true, force: true });
    }
  });

  it("uses the base config despite staged config tampering and blocks a changed secret", () => {
    const fakeToken = [
      "gh",
      "p_",
      "AbCd1234EfGh5678IjKl",
      "9012MnOp3456QrSt",
    ].join("");
    const fixture = createHostedHookFixture({
      baseConfig: gitleaksConfig.replace(
        "  paths = [",
        "  paths = [\n    '''scripts/__tests__/''',",
      ),
      candidateFile: `token = "${fakeToken}"\n`,
      candidatePath: "scripts/__tests__/hosted-hook-fixture.txt",
      candidateConfig: "",
    });

    try {
      const result = runHostedHook(fixture);
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).not.toBe(0);
      expect(output).toContain(fixture.candidatePath);
      expect(output).toContain("leaks found: 1");
      expect(output).toContain("Gitleaks falhou; commit bloqueado");
      expect(output).not.toContain(fakeToken);
      expect(readFileSync(fixture.observationFile, "utf8")).toBe(
        `HEAD=${fixture.baseSha}\nINDEX_TREE=${fixture.candidateTree}\nSTAGED=present\nCONFIG_SHA=${fixture.trustedConfigSha256}\n`,
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("passes a clean candidate through the same hosted pre-commit path", () => {
    const fixture = createHostedHookFixture({
      candidateFile: "const clean = true;\n",
    });

    try {
      const result = runHostedHook(fixture);

      expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
      expect(readFileSync(fixture.observationFile, "utf8")).toBe(
        `HEAD=${fixture.baseSha}\nINDEX_TREE=${fixture.candidateTree}\nSTAGED=present\nCONFIG_SHA=${fixture.trustedConfigSha256}\n`,
      );
      const scan = runHostedGitleaks(fixture);
      expect(scan.status, `${scan.stdout}${scan.stderr}`).toBe(0);
      expect(
        readdirSync(fixture.root).filter((entry) =>
          entry.startsWith("open3dcalc-hosted-gitleaks."),
        ),
      ).toEqual([]);
      expect(
        runGit(["worktree", "list", "--porcelain"], fixture.repository)
          .split("\n")
          .filter((line) => line.startsWith("worktree ")),
      ).toEqual([`worktree ${fixture.repository}`]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("fails closed when hosted snapshot creation fails", () => {
    const fixture = createHostedHookFixture({
      candidateFile: "const clean = true;\n",
    });

    try {
      failGitWorktreeOperation(join(fixture.root, "bin"), "add");
      const scan = runHostedGitleaks(fixture);

      expect(scan.status).not.toBe(0);
      expect(`${scan.stdout}${scan.stderr}`).toContain(
        "Unable to create the hosted Gitleaks snapshot worktree",
      );
      expect(
        readdirSync(fixture.root).filter((entry) =>
          entry.startsWith("open3dcalc-hosted-gitleaks."),
        ),
      ).toEqual([]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("fails closed when hosted snapshot cleanup fails after a clean scan", () => {
    const fixture = createHostedHookFixture({
      candidateFile: "const clean = true;\n",
    });

    try {
      failGitWorktreeOperation(join(fixture.root, "bin"), "remove");
      const scan = runHostedGitleaks(fixture);

      expect(scan.status).not.toBe(0);
      expect(`${scan.stdout}${scan.stderr}`).toContain(
        "Unable to remove generated hosted Gitleaks worktree",
      );
      expect(
        readdirSync(fixture.root).some((entry) =>
          entry.startsWith("open3dcalc-hosted-gitleaks."),
        ),
      ).toBe(true);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("blocks a test-path secret with the independent base-to-candidate scan when the candidate hook skips Gitleaks", () => {
    const fakeToken = syntheticGitHubToken();
    const fixture = createHostedHookFixture({
      baseConfig: gitleaksConfig.replace(
        "  paths = [",
        "  paths = [\n    '''scripts/__tests__/''',",
      ),
      candidateFile: `token = "${fakeToken}"\n`,
      candidatePath: "scripts/__tests__/candidate-secret-fixture.txt",
      hook: "#!/usr/bin/env sh\nexit 0\n",
    });

    try {
      const hookResult = runHostedHook(fixture);
      expect(
        hookResult.status,
        `${hookResult.stdout}${hookResult.stderr}`,
      ).toBe(0);
      expect(betaWorkflow).toContain(
        "run_verified_gate 'pinned base..candidate Gitleaks scan'",
      );
      expect(betaWorkflow).toContain("bash scripts/scan-hosted-gitleaks.sh");
      expect(betaWorkflow).toContain("bash scripts/hosted-pre-commit.sh");
      expect(hostedGitleaksScanner).toContain(
        '--log-opts="$GATE_BASE_SHA..$CANDIDATE_SHA"',
      );
      expect(hostedGitleaksScanner).toContain(
        '--gitleaks-ignore-path "$trusted_ignore"',
      );
      expect(hostedGitleaksScanner).toContain(
        'git -C "$candidate_repo" worktree add --quiet --detach "$scan_worktree" "$GATE_BASE_SHA"',
      );
      expect(hostedGitleaksScanner).toContain(
        'git -C "$scan_worktree" read-tree --reset -u "$candidate_tree"',
      );
      expect(hostedGitleaksScanner).toContain(
        'rm -rf -- "$scan_worktree/.gitleaksignore"',
      );
      expect(hostedGitleaksScanner).toContain(
        'show "$GATE_BASE_SHA:.gitleaks.toml" > "$trusted_config_source"',
      );
      expect(hostedGitleaksScanner).toContain('--config "$trusted_config"');
      expect(hostedGitleaksScanner).toContain("--ignore-gitleaks-allow");
      expect(hostedGitleaksScanner).not.toContain("mv --");
      expect(betaWorkflow).not.toContain("candidate_gitleaks_ignore");

      const initialScan = runHostedGitleaks(fixture);
      expect(initialScan.status).not.toBe(0);
      const finding = JSON.parse(initialScan.stdout).find(
        (candidate: { File: string }) =>
          candidate.File === fixture.candidatePath,
      );
      expect(finding?.Fingerprint).toEqual(expect.any(String));

      const workingIgnore = join(fixture.repository, ".gitleaksignore");
      writeFileSync(workingIgnore, `${finding.Fingerprint}\n`);
      expect(runGit(["status", "--short"], fixture.repository)).toContain(
        "?? .gitleaksignore",
      );
      const untrackedIgnoreScan = runHostedGitleaks(fixture);
      const untrackedOutput = `${untrackedIgnoreScan.stdout}${untrackedIgnoreScan.stderr}`;
      expect(untrackedIgnoreScan.status).toBe(1);
      expect(untrackedOutput).toContain(fixture.candidatePath);
      expect(untrackedOutput).not.toContain(fakeToken);
      expect(readFileSync(workingIgnore, "utf8")).toBe(
        `${finding.Fingerprint}\n`,
      );

      runGit(["add", ".gitleaksignore"], fixture.repository);
      runGit(
        ["commit", "--quiet", "-m", "candidate ignore"],
        fixture.repository,
      );
      refreshHostedCandidate(fixture);
      const trackedIgnoreScan = runHostedGitleaks(fixture);
      const trackedOutput = `${trackedIgnoreScan.stdout}${trackedIgnoreScan.stderr}`;
      expect(trackedIgnoreScan.status).toBe(1);
      expect(trackedOutput).toContain(fixture.candidatePath);
      expect(trackedOutput).not.toContain(fakeToken);
      expect(readFileSync(workingIgnore, "utf8")).toBe(
        `${finding.Fingerprint}\n`,
      );
      expect(
        readdirSync(fixture.root).filter((entry) =>
          entry.startsWith("open3dcalc-hosted-gitleaks."),
        ),
      ).toEqual([]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
