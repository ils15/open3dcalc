import { describe, it, expect } from "vitest";
import {
  encryptWithPassphrase,
  decryptWithPassphrase,
  canonicalJson,
  PBKDF2_ITERATIONS,
  ENVELOPE_VERSION,
  EnvelopeRejectedError,
} from "@/shared/lib/crypto/envelope";

// ---------------------------------------------------------------------------
// D1.1 S2 — at-rest passphrase envelope (ADR-001 §2.1/§2.2, SPEC-03 params).
// Uses the REAL Web Crypto API (no mocks — TEST-MATRIX §0).
// Synthetic fixtures only, never real PII.
// ---------------------------------------------------------------------------

const AAD = { purpose: "at-rest", key: "open3dcalc_customers_v1" } as const;
const PASS = "sessão-sintética-de-teste-3131";
const PLAINTEXT = "Fernanda Sintética <fernanda@exemplo.teste>";

describe("crypto envelope (SPEC-03 params, ADR-001)", () => {
  it("round-trips plaintext through a real AES-256-GCM envelope", async () => {
    const blob = await encryptWithPassphrase(PLAINTEXT, PASS, AAD);
    expect(blob).not.toContain(PLAINTEXT);
    const back = await decryptWithPassphrase(blob, PASS);
    expect(back).toBe(PLAINTEXT);
  });

  it("envelope header records the normative SPEC-03 parameters", async () => {
    const blob = await encryptWithPassphrase(PLAINTEXT, PASS, AAD);
    const env = JSON.parse(blob) as Record<string, unknown>;
    expect(env.v).toBe(ENVELOPE_VERSION);
    const kdf = env.kdf as Record<string, unknown>;
    expect(kdf.alg).toBe("PBKDF2-SHA256");
    expect(kdf.it).toBe(PBKDF2_ITERATIONS);
    expect(kdf.it).toBe(310_000); // OWASP 2023 — exactly, per SPEC-03
    expect(String(kdf.salt)).toHaveLength(32); // 128-bit salt, hex
    const cipher = env.cipher as Record<string, unknown>;
    expect(cipher.alg).toBe("AES-256-GCM");
    expect(String(cipher.iv)).toHaveLength(24); // 96-bit IV, hex
  });

  it("salt and IV are random per envelope (never reused)", async () => {
    const a = JSON.parse(
      await encryptWithPassphrase(PLAINTEXT, PASS, AAD),
    ) as Record<string, unknown>;
    const b = JSON.parse(
      await encryptWithPassphrase(PLAINTEXT, PASS, AAD),
    ) as Record<string, unknown>;
    expect((a.kdf as { salt: string }).salt).not.toBe(
      (b.kdf as { salt: string }).salt,
    );
    expect((a.cipher as { iv: string }).iv).not.toBe(
      (b.cipher as { iv: string }).iv,
    );
    expect(a.ct).not.toBe(b.ct);
  });

  it("rejects a wrong passphrase indistinguishably from tampering", async () => {
    const blob = await encryptWithPassphrase(PLAINTEXT, PASS, AAD);
    await expect(
      decryptWithPassphrase(blob, "outra-senha-totalmente-diferente"),
    ).rejects.toThrow(EnvelopeRejectedError);
    // Same error type/message as tamper (SPEC-03 §7.3 principle).
    const env = JSON.parse(blob) as Record<string, unknown>;
    env.ct = String(env.ct).slice(0, -2) + "AA";
    await expect(
      decryptWithPassphrase(JSON.stringify(env), PASS),
    ).rejects.toThrow(/envelope rejected/);
  });

  it("binds the AAD: any header drift breaks decryption", async () => {
    const blob = await encryptWithPassphrase(PLAINTEXT, PASS, AAD);
    const env = JSON.parse(blob) as Record<string, unknown>;
    const aad = env.aad as Record<string, unknown>;
    aad.key = "open3dcalc_quotes_v1";
    await expect(
      decryptWithPassphrase(JSON.stringify(env), PASS),
    ).rejects.toThrow(EnvelopeRejectedError);
  });

  it("rejects unknown versions and non-normative parameters", async () => {
    const blob = await encryptWithPassphrase(PLAINTEXT, PASS, AAD);
    const env = JSON.parse(blob) as Record<string, unknown>;
    env.v = "9.9";
    await expect(decryptWithPassphrase(JSON.stringify(env), PASS)).rejects.toThrow(
      EnvelopeRejectedError,
    );
    const env2 = JSON.parse(blob) as Record<string, unknown>;
    (env2.kdf as { it: number }).it = 100_000; // legacy 1.0 iterations
    await expect(
      decryptWithPassphrase(JSON.stringify(env2), PASS),
    ).rejects.toThrow(EnvelopeRejectedError);
    await expect(decryptWithPassphrase("not-json", PASS)).rejects.toThrow(
      EnvelopeRejectedError,
    );
  });

  it("canonicalJson is stable and sorted (AAD binding basis)", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ a: { d: 1, c: [2, 1] } })).toBe(
      '{"a":{"c":[2,1],"d":1}}',
    );
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});
