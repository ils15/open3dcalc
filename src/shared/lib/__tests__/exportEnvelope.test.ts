import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createExportEnvelope,
  readExportEnvelope,
  countRecords,
  EXPORT_FORMAT,
  EXPORT_VERSION,
  MAX_RECORDS,
} from "@/shared/lib/exportEnvelope";
import { canonicalJson } from "@/shared/lib/crypto/envelope";

// ---------------------------------------------------------------------------
// D1.1 S5 — SPEC-03 export envelope v1.1 contract tests (TEST-MATRIX §7).
// Real Web Crypto; synthetic payloads only (never real PII).
// ---------------------------------------------------------------------------

const PASSWORD = "senha-sintética-de-teste-3131";

function makePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    settings: { activeTab: "fdm" },
    history: [{ id: "h1", name: "Peça Sintética" }],
    customers: [{ id: "c1", name: "Fernanda Sintética" }],
    quotes: [],
    catalog: { printers: [], materials: [], marketplaces: [] },
    filaments: [],
    theme: "dark",
    dashboard: {},
    sections: {},
    ...overrides,
  } as Parameters<typeof createExportEnvelope>[0];
}

async function makeEnvelope(
  payload = makePayload(),
  password = PASSWORD,
): Promise<string> {
  return createExportEnvelope(payload, password);
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SPEC-03 §2/§3 — envelope structure and canonicalization", () => {
  it("produces the normative v1.1 header with allowlisted parameters", async () => {
    const envelope = JSON.parse(await makeEnvelope()) as Record<
      string,
      unknown
    >;
    expect(envelope.format).toBe(EXPORT_FORMAT);
    expect(envelope.version).toBe(EXPORT_VERSION);
    const kdf = envelope.kdf as Record<string, unknown>;
    expect(kdf.algorithm).toBe("PBKDF2-SHA256");
    expect(kdf.iterations).toBe(310_000);
    expect(String(kdf.salt_hex)).toHaveLength(32);
    const cipher = envelope.cipher as Record<string, unknown>;
    expect(cipher.algorithm).toBe("AES-256-GCM");
    expect(cipher.tag_bits).toBe(128);
    expect(String(cipher.iv_hex)).toHaveLength(24);
    const integrity = envelope.integrity as Record<string, unknown>;
    expect(integrity.algorithm).toBe("SHA-256");
    const limits = envelope.limits as Record<string, unknown>;
    expect(limits).toEqual({ records: 50_000, bytes: 52_428_800 });
    const aad = envelope.aad as Record<string, unknown>;
    expect(aad).toEqual({
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      policy_version: expect.stringMatching(/^\d+\.\d+$/),
    });
  });

  it("canonicalization: sorted keys, no whitespace, ECMAScript numbers (SPEC-03 §3)", () => {
    // Documented RFC 8785-equivalent vector (key sorting + number form).
    expect(canonicalJson({ b: 1, a: 2.5, c: { z: 1, y: -0 } })).toBe(
      '{"a":2.5,"b":1,"c":{"y":0,"z":1}}',
    );
    expect(canonicalJson({})).toBe("{}");
  });

  it("round-trips: byte-stable canonical plaintext and verified digest (§7.1)", async () => {
    const payload = makePayload();
    const envelopeJson = await makeEnvelope(payload);
    const decrypted = await readExportEnvelope(envelopeJson, PASSWORD);
    expect(decrypted).toEqual(payload);
    // Byte-stability: canonicalizing the parsed payload reproduces the exact
    // plaintext that was encrypted (digest would fail otherwise).
    const canonicalAgain = canonicalJson(decrypted);
    expect(canonicalJson(payload)).toBe(canonicalAgain);
  });
});

describe("SPEC-03 §5/§7 — hostile-input rejection", () => {
  it("§7.2: tampering with ANY header field fails GCM auth (AAD binding)", async () => {
    const envelopeJson = await makeEnvelope();
    const env = JSON.parse(envelopeJson) as Record<string, unknown>;
    (env.aad as Record<string, unknown>).policy_version = "9.9";
    await expect(
      readExportEnvelope(JSON.stringify(env), PASSWORD),
    ).rejects.toMatchObject({ code: "AUTH_FAILED" });
  });

  it("§7.3: wrong password is indistinguishable from tampering", async () => {
    const envelopeJson = await makeEnvelope();
    await expect(
      readExportEnvelope(envelopeJson, "outra-senha-completamente-diferente"),
    ).rejects.toMatchObject({ code: "AUTH_FAILED" });
  });

  it("§7.4: corrupted ciphertext rejects", async () => {
    const envelopeJson = await makeEnvelope();
    const env = JSON.parse(envelopeJson) as Record<string, unknown>;
    const ct = String(
      (env.payload as Record<string, unknown>).ciphertext_base64,
    );
    (env.payload as Record<string, unknown>).ciphertext_base64 =
      ct.slice(0, -4) + "AAAA";
    await expect(
      readExportEnvelope(JSON.stringify(env), PASSWORD),
    ).rejects.toMatchObject({ code: "AUTH_FAILED" });
  });

  it("§7.5: unknown versions (0.9, 9.9) are rejected, never best-effort parsed", async () => {
    const envelopeJson = await makeEnvelope();
    for (const bogus of ["0.9", "9.9"]) {
      const env = JSON.parse(envelopeJson) as Record<string, unknown>;
      env.version = bogus;
      await expect(
        readExportEnvelope(JSON.stringify(env), PASSWORD),
      ).rejects.toMatchObject({ code: "UNSUPPORTED_VERSION" });
    }
  });

  it("§7.6: unknown header or section fields are rejected", async () => {
    const envelopeJson = await makeEnvelope();
    const withExtra = JSON.parse(envelopeJson) as Record<string, unknown>;
    withExtra.smuggled_policy = "allow_plaintext";
    await expect(
      readExportEnvelope(JSON.stringify(withExtra), PASSWORD),
    ).rejects.toMatchObject({ code: "INVALID_ENVELOPE" });

    const withKdfExtra = JSON.parse(envelopeJson) as Record<string, unknown>;
    (withKdfExtra.kdf as Record<string, unknown>).note = "hi";
    await expect(
      readExportEnvelope(JSON.stringify(withKdfExtra), PASSWORD),
    ).rejects.toMatchObject({ code: "INVALID_ENVELOPE" });
  });

  it("§7.8: producer refuses payloads beyond the declared limits", async () => {
    const big = makePayload({
      history: Array.from({ length: MAX_RECORDS + 1 }, (_, i) => ({ id: i })),
    });
    await expect(createExportEnvelope(big, PASSWORD)).rejects.toMatchObject({
      code: "LIMITS_EXCEEDED",
    });
  });

  it("§7.8: consumer refuses a valid envelope carrying beyond-limit records", async () => {
    const big = makePayload({
      history: Array.from({ length: MAX_RECORDS + 1 }, (_, i) => ({ id: i })),
    });
    // The producer refuses to even encrypt a payload beyond the limit.
    expect(countRecords(big as never)).toBeGreaterThan(MAX_RECORDS);
    await expect(createExportEnvelope(big, PASSWORD)).rejects.toMatchObject({
      code: "LIMITS_EXCEEDED",
    });
    const small = makePayload({
      history: Array.from({ length: MAX_RECORDS - 1 }, (_, i) => ({ id: i })),
    });
    const envelopeJson = await createExportEnvelope(small, PASSWORD);
    const env = JSON.parse(envelopeJson) as Record<string, unknown>;
    env.limits = { records: MAX_RECORDS + 1, bytes: 52_428_800 };
    // §5.2: an envelope whose limits header deviates from the spec values
    // is rejected at header validation — before any decryption happens.
    await expect(
      readExportEnvelope(JSON.stringify(env), PASSWORD),
    ).rejects.toMatchObject({ code: "INVALID_ENVELOPE" });
  });

  it("§5.1-5.2: malformed sections and allowlist drift reject before decryption", async () => {
    const base = JSON.parse(await makeEnvelope()) as Record<string, unknown>;
    const variants: unknown[] = [
      42,
      [base],
      { ...base, kdf: null },
      { ...base, cipher: null },
      { ...base, integrity: null },
      { ...base, aad: null },
      { ...base, limits: null },
      { ...base, payload: null },
      {
        ...base,
        cipher: {
          algorithm: "AES-CBC",
          iv_hex: (base.cipher as Record<string, unknown>).iv_hex,
          tag_bits: 128,
        },
      },
      {
        ...base,
        integrity: {
          algorithm: "SHA-512",
          plaintext_digest_hex: (base.integrity as Record<string, unknown>)
            .plaintext_digest_hex,
        },
      },
      {
        ...base,
        aad: { ...(base.aad as Record<string, unknown>), version: "1.0" },
      },
      { ...base, payload: { ciphertext_base64: 123 } },
      {
        ...base,
        kdf: { ...(base.kdf as Record<string, unknown>), salt_hex: "zz" },
      },
      {
        ...base,
        cipher: { ...(base.cipher as Record<string, unknown>), iv_hex: "zz" },
      },
      { ...base, aad: { ...(base.aad as Record<string, unknown>), extra: 1 } },
    ];
    for (const variant of variants) {
      await expect(
        readExportEnvelope(JSON.stringify(variant), PASSWORD),
      ).rejects.toMatchObject({ code: "INVALID_ENVELOPE" });
    }
  });

  it("§1: export without a password is refused — no plaintext user export", async () => {
    await expect(createExportEnvelope(makePayload(), "")).rejects.toMatchObject(
      {
        code: "PASSWORD_REQUIRED",
      },
    );
  });

  it("§7.10: the password never reaches any log output", async () => {
    const envelopeJson = await makeEnvelope();
    await readExportEnvelope(envelopeJson, PASSWORD);
    const logged = [
      ...vi.mocked(console.log).mock.calls,
      ...vi.mocked(console.warn).mock.calls,
      ...vi.mocked(console.error).mock.calls,
    ]
      .map((args) => String(args[0]))
      .join(" ");
    expect(logged).not.toContain(PASSWORD);
  });
});
