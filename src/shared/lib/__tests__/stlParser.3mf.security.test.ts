// @vitest-environment node
// Security hardening tests for the 3MF parser: anti-zip-bomb caps and part
// path resolution. They run in Node (not jsdom) because they either fail
// before any DOM parsing happens or only exercise pure helpers.
import { describe, it, expect } from "vitest";
import {
  analyzeMeshFile,
  resolveModelPath,
  ZipBombError,
  MAX_DECOMPRESSED_TOTAL,
  MAX_EACH_ENTRY,
  MAX_ENTRIES,
  MAX_RATIO,
  MAX_DEPTH,
} from "../stlParser";

/**
 * Builds a minimal stored-entry ZIP with control over the declared
 * uncompressed size and entry count in the central directory, to simulate
 * lying headers without allocating the claimed bytes.
 */
function makeBombZip(opts: {
  declaredSize?: number;
  entryCount?: number;
}): Uint8Array {
  const enc = new TextEncoder();
  const name = enc.encode("3D/3dmodel.model");
  const data = enc.encode("<model/>");

  const local = new Uint8Array(30 + name.length + data.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(8, 0, true);
  lv.setUint32(18, data.length, true);
  lv.setUint32(22, data.length, true);
  lv.setUint16(26, name.length, true);
  local.set(name, 30);
  local.set(data, 30 + name.length);

  const central = new Uint8Array(46 + name.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(10, 0, true);
  cv.setUint32(20, data.length, true);
  cv.setUint32(24, opts.declaredSize ?? data.length, true);
  cv.setUint16(28, name.length, true);
  cv.setUint32(42, 0, true);
  central.set(name, 46);

  const count = opts.entryCount ?? 1;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, count, true);
  ev.setUint16(10, count, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, local.length, true);

  const out = new Uint8Array(local.length + central.length + eocd.length);
  out.set(local, 0);
  out.set(central, local.length);
  out.set(eocd, local.length + central.length);
  return out;
}

describe("3MF hardening", () => {
  it("exports caps sized between real slicer files (100MB+/part) and bombs (GBs)", () => {
    // Regression anchor: a real 15.6MB 3MF carries a ~76MB part (ratio ~5:1),
    // and multicolor/lithophane parts exceed 100MB per part, so the caps must
    // sit comfortably above that while MAX_RATIO (100:1, vs ~10^9 for 42.zip)
    // remains the actual bomb stopper.
    expect(MAX_DECOMPRESSED_TOTAL).toBe(1024 * 1024 * 1024);
    expect(MAX_EACH_ENTRY).toBe(512 * 1024 * 1024);
    expect(MAX_RATIO).toBe(100);
    expect(MAX_ENTRIES).toBe(200);
    expect(MAX_DEPTH).toBe(8);
  });

  it("resolveModelPath normalizes p:path forms to a single key", () => {
    expect(resolveModelPath("/3D/Objects/object_1.model")).toBe(
      "3D/Objects/object_1.model",
    );
    expect(resolveModelPath("3D\\Objects\\object_1.model")).toBe(
      "3D/Objects/object_1.model",
    );
    expect(resolveModelPath("/3D/./Objects/object_1.model")).toBe(
      "3D/Objects/object_1.model",
    );
    expect(resolveModelPath("/3D/Objects/../Objects/object_1.model")).toBe(
      "3D/Objects/object_1.model",
    );
  });

  it("resolveModelPath keeps case (OPC lookup is case-sensitive)", () => {
    expect(resolveModelPath("/3D/3DMODEL.MODEL")).toBe("3D/3DMODEL.MODEL");
  });

  it("resolveModelPath rejects .. escaping the package root", () => {
    expect(() => resolveModelPath("/../evil.model")).toThrow(
      /escapes package root/,
    );
    expect(() => resolveModelPath("/3D/../../evil.model")).toThrow(
      /escapes package root/,
    );
  });

  it("rejects an entry declaring an absurd size with ZipBombError", async () => {
    const zip = makeBombZip({ declaredSize: 0xffffffff });
    const file = new File([zip as BlobPart], "bomb.3mf");
    await expect(analyzeMeshFile(file)).rejects.toThrow(ZipBombError);
  });

  it("rejects an absurd declared expansion ratio with ZipBombError", async () => {
    // 8 stored bytes claiming to expand to 8MB: ratio ~1M:1.
    const zip = makeBombZip({ declaredSize: 8 * 1024 * 1024 });
    const file = new File([zip as BlobPart], "bomb.3mf");
    await expect(analyzeMeshFile(file)).rejects.toThrow(/expansion ratio/);
  });

  it("rejects a central directory declaring too many entries", async () => {
    const zip = makeBombZip({ entryCount: MAX_ENTRIES + 1 });
    const file = new File([zip as BlobPart], "bomb.3mf");
    await expect(analyzeMeshFile(file)).rejects.toThrow(ZipBombError);
  });
});
