import { describe, expect, it } from "vitest";
import {
  compareSemver,
  parseArgs,
  parseSemver,
  resolveNextVersion,
} from "../prepare-release.mjs";

describe("prepare-release SemVer logic", () => {
  it("parses valid semver versions and tags", () => {
    expect(parseSemver("1.14.0")).toEqual({
      major: 1,
      minor: 14,
      patch: 0,
      rc: null,
      version: "1.14.0",
      tag: "v1.14.0",
    });

    expect(parseSemver("v2.0.0-rc.11")).toEqual({
      major: 2,
      minor: 0,
      patch: 0,
      rc: 11,
      version: "2.0.0-rc.11",
      tag: "v2.0.0-rc.11",
    });

    expect(parseSemver("invalid")).toBeNull();
  });

  it("compares SemVer versions correctly", () => {
    const v1_14 = parseSemver("1.14.0")!;
    const v2_rc1 = parseSemver("2.0.0-rc.1")!;
    const v2_rc2 = parseSemver("2.0.0-rc.2")!;
    const v2_rc11 = parseSemver("2.0.0-rc.11")!;
    const v2_stable = parseSemver("2.0.0")!;

    expect(compareSemver(v2_rc1, v1_14)).toBeGreaterThan(0);
    expect(compareSemver(v2_rc2, v2_rc1)).toBeGreaterThan(0);
    expect(compareSemver(v2_rc11, v2_rc2)).toBeGreaterThan(0);
    expect(compareSemver(v2_stable, v2_rc11)).toBeGreaterThan(0);
    expect(compareSemver(v2_rc11, v2_stable)).toBeLessThan(0);
    expect(compareSemver(v2_rc11, v2_rc11)).toBe(0);
  });

  it("calculates next version for bump types", () => {
    // RC bumps
    expect(resolveNextVersion("2.0.0-rc.11", "rc")).toBe("2.0.0-rc.12");
    expect(resolveNextVersion("1.14.0", "rc")).toBe("1.14.1-rc.1");

    // Patch promotion (RC -> Stable)
    expect(resolveNextVersion("2.0.0-rc.11", "patch")).toBe("2.0.0");
    // Standard patch bump
    expect(resolveNextVersion("2.0.0", "patch")).toBe("2.0.1");

    // Minor bump
    expect(resolveNextVersion("2.0.0-rc.11", "minor")).toBe("2.1.0");
    expect(resolveNextVersion("2.0.0", "minor")).toBe("2.1.0");

    // Major bump
    expect(resolveNextVersion("2.0.0-rc.11", "major")).toBe("3.0.0");
    expect(resolveNextVersion("2.0.0", "major")).toBe("3.0.0");
  });

  it("parses CLI flags correctly", () => {
    expect(parseArgs(["--bump", "rc", "--dry-run"])).toEqual({
      isDryRun: true,
      skipBattery: false,
      allowBranch: false,
      versionArg: undefined,
      bumpArg: "rc",
    });

    expect(
      parseArgs([
        "--version",
        "2.0.0-rc.12",
        "--skip-battery",
        "--allow-branch",
      ]),
    ).toEqual({
      isDryRun: false,
      skipBattery: true,
      allowBranch: true,
      versionArg: "2.0.0-rc.12",
      bumpArg: undefined,
    });

    expect(() => parseArgs(["--invalid-flag"])).toThrow("Unknown flag");
  });
});
