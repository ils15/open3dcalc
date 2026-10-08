/**
 * SPEC-01 declaration and egress exclusion for the browser PII vault.
 *
 * Three separate claims, pinned together because they move together:
 *
 *  1. **The declaration.** The vault is a distinct `indexeddb` surface, not a
 *     `localStorage` key. It was declared only when this task landed — until
 *     then the single largest PII store in the web build (three PII keys'
 *     worth of records, sealed) was an UNDECLARED surface, which is the
 *     `pii_stage` omission one layer out.
 *  2. **The re-consent consequence.** A new declared PII surface is a
 *     privacy-contract change, so `policy_version` moves 1.6 → 1.7 and a
 *     SPEC-04 receipt issued under 1.6 evaluates `policy_mismatch`.
 *  3. **The egress path.** `dataSync` reaches the vault-backed PII ONLY by
 *     reading the three hydrated stores — never by opening IndexedDB, naming
 *     the vault record, or enumerating storage. That guarantee is STRUCTURAL —
 *     `dataSync` reads a fixed list of `localStorage` key literals plus the
 *     three store singletons and never enumerates a store — and a structural
 *     guarantee is exactly the kind that gets broken by one careless
 *     `for (const key of ...)` later. Both halves are pinned: the behaviour (an
 *     unhydrated vault leaks nothing, and the SEALED record never appears in a
 *     collected bundle) and the shape (the source contains no storage
 *     enumeration, no `indexedDB`, and no vault reference).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import manifestFixture from "../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import {
  getEntry,
  loadManifest,
  type ManifestDocument,
} from "@/shared/lib/dataManifest";
import { collectSyncData } from "@/shared/lib/dataSync";
import {
  createPiiStore,
  lockAllPiiStores,
  PII_VAULT_KEY,
  resetPiiStoreRuntimeForTests,
  unlockPiiStore,
} from "@/shared/lib/crypto/piiStore";
import { setDemoPersistenceSuppressed } from "@/shared/lib/manifestStorage";
import {
  configurePiiStoreRuntime,
  rehydratePiiStores,
  resetPiiStoreHydrationForTests,
} from "@/shared/lib/crypto/piiStoreHydration";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import {
  setPiiPersistenceDeclined,
  setPiiStoreEnvironment,
} from "@/shared/lib/crypto/piiStoreCapability";
import { zeroizeSessionPassphrase } from "@/shared/lib/crypto/passphraseSession";
import { PII_STORE_ENVIRONMENT } from "@/shared/lib/crypto/__tests__/piiStoreFixtures";
import {
  createFakeIndexedDb,
  type FakeIndexedDb,
} from "@/shared/test/fakeIndexedDb";
import { PII_SCHEMA_VERSION } from "@/shared/lib/crypto/piiSchemaVersion";

const doc = manifestFixture as ManifestDocument;
const CUSTOMERS = "open3dcalc_customers_v1";
const PASS = "senha-sintética-de-teste-4242";

/** A marker that appears ONLY inside sealed PII, never in a real field. */
const SENTINEL = "zz-placa-sintetica-nao-exportavel-4242";

describe("SPEC-01: the vault is a declared PII indexeddb surface", () => {
  it("is registered as a distinct surface, not a localStorage key", () => {
    const entry = getEntry(loadManifest(doc), PII_VAULT_KEY);
    expect(entry).toMatchObject({
      key: PII_VAULT_KEY,
      surface: "indexeddb",
      // The vault is a browser store. Electron PII lives in `db/`, and this
      // declaration must not imply a desktop surface that does not exist.
      platforms: ["web", "pwa"],
      class: "user_content",
      pii: true,
      persistence: "encrypted_at_rest",
      sync: "never",
      export: "never",
      erasure: "erase_on_delete_all",
      legal_basis: "consent",
      owner: "hermes",
    });
  });

  it("is not one of the plaintext localStorage keys it replaces", () => {
    const vault = getEntry(loadManifest(doc), PII_VAULT_KEY);
    // The failure this prevents: declaring the vault as a `localStorage`
    // entry, which would make the inventory say the PII is still in
    // localStorage — a claim that is both wrong and reassuringly familiar.
    expect(vault?.surface).not.toBe("localStorage");
    // The three real PII keys keep their own declarations; this task does not
    // rewrite them, it adds the surface they will migrate onto.
    for (const key of [
      CUSTOMERS,
      "open3dcalc_quotes_v1",
      "open3dcalc_history_v2",
    ]) {
      expect(getEntry(loadManifest(doc), key)?.surface).toBe("localStorage");
    }
  });

  it("declares retention that is true, including the absence of a sweeper", () => {
    const vault = getEntry(loadManifest(doc), PII_VAULT_KEY);
    // The records are the user's own customers/quotes/history, so they live
    // exactly as long as the user keeps them: no TTL, and none claimed.
    expect(vault?.retention).toEqual({
      policy: "user_controlled",
      max_days: 0,
    });
    // There is NO TTL sweeper anywhere, so the purpose has to say so — an
    // undeclared gap is the `appdata_temp_staging` mistake.
    expect(vault?.purpose).toMatch(/no ttl sweeper|no ttl/i);
    // And the honest ceiling: unreadable without the passphrase, which is not
    // retention, so it is disclosed as a property rather than sold as one.
    expect(vault?.purpose).toMatch(/passphrase/i);
    expect(vault?.purpose).toMatch(/never synced|not synced|sync: never/i);
  });

  it("declares erase_on_delete_all for the sealed vault", () => {
    // The declaration has to say the sealed records go on delete-all; the
    // renderer sweep itself is fail-closed (the broad adapters were removed),
    // so this pins the manifest contract, not a live execution path.
    expect(getEntry(loadManifest(doc), PII_VAULT_KEY)?.erasure).toBe(
      "erase_on_delete_all",
    );
    expect(PII_VAULT_KEY.startsWith("open3dcalc_")).toBe(true);
  });

  it("is at schema version 1, the value PII_SCHEMA_VERSION is pinned to", () => {
    // ADR-001 §3.3 `TODO(hermes)`: `S` is a CONSTANT, not a per-key lookup, so
    // a PII at-rest entry whose `version` moves off 1 will strand every
    // existing envelope for that key the day the lookup lands. This entry
    // starts new, so it starts where the constant points.
    expect(getEntry(loadManifest(doc), PII_VAULT_KEY)?.version).toBe("1.0");
  });
});

describe("SPEC-04: policy_version 1.8 re-consents a 1.6 receipt", () => {
  it("is 1.8", () => {
    expect(doc.policy_version).toBe("1.8");
  });

  it("states why re-consenting is still free — nothing has shipped", async () => {
    // The exemption is a property of the RELEASE STATE, not of the process.
    // Recorded as an assertion so a later reader cannot mistake 1.8 for a
    // routine bump and repeat the reasoning at 1.9 when it is no longer free.
    // 1.7 declared the vault; 1.8 declared `legacy_residue`. Neither had
    // shipped. See SPEC-04 §6.
    const { issueReceipt, evaluateReceipt, receiptDigest } =
      await import("@/shared/lib/consentReceipt");
    const { receipt } = await issueReceipt([PII_VAULT_KEY], ["rehome_pii"]);
    const under1_6 = {
      ...receipt,
      policy_version: "1.6",
      policy_hash: `sha256:${"0".repeat(64)}`,
    };
    const evaluation = await evaluateReceipt({
      receipt: under1_6,
      digest: await receiptDigest(under1_6),
    });
    // `policy_mismatch`, not `tampered`: the receipt is intact, the POLICY the
    // user consented to changed.
    expect(evaluation.status).toBe("policy_mismatch");
    expect(evaluation.consentGiven).toBe(false);
    // The old receipt is retained as history for the delta UI, not discarded.
    expect(evaluation.receipt?.policy_version).toBe("1.6");
    expect(evaluation.currentPolicyVersion).toBe("1.8");
  });

  it("a receipt issued under 1.8 validates, so the re-consent path is reachable", async () => {
    const { issueReceipt } = await import("@/shared/lib/consentReceipt");
    const { receipt } = await issueReceipt([PII_VAULT_KEY], ["rehome_pii"]);
    expect(receipt.policy_version).toBe("1.8");
  });
});

describe("ADR-001 §3.3: the browser and Electron schema versions agree", () => {
  it("matches the pin in electron/cryptoCapability.ts", () => {
    // The two layers cannot import each other today: the main process cannot
    // reach the JSON fixture (node16 ESM output will not execute a static JSON
    // import), and this module is not on the electron build's import allowlist.
    // So the value is duplicated and the DUPLICATION IS PINNED — a drift here
    // would seal browser records under an `S` the desktop build never uses,
    // with no error anywhere.
    const source = readFileSync(
      resolve(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "electron",
        "cryptoCapability.ts",
      ),
      "utf8",
    );
    const pinned = source.match(/const PII_SCHEMA_VERSION = (\d+);/);
    expect(
      pinned,
      "the electron pin must remain a literal this test can read",
    ).not.toBeNull();
    expect(Number(pinned![1])).toBe(PII_SCHEMA_VERSION);
  });

  it("and the manifest is what will replace both", () => {
    // Neither constant survives the TODO(hermes) per-key lookup: the trusted
    // source is the per-key `version`, so the manifest is the destination for
    // BOTH of these pins, not just the electron one.
    const atRest = doc.keys.filter(
      (k) => k.pii && k.persistence === "encrypted_at_rest",
    );
    expect(atRest.length).toBeGreaterThan(0);
    const drifted = atRest
      .filter((k) => Number(k.version.split(".")[0]) !== PII_SCHEMA_VERSION)
      .map((k) => `${k.key}@${k.version}`);
    expect(
      drifted,
      "PII_SCHEMA_VERSION is a constant on BOTH platforms, not a per-key manifest lookup: bumping a PII key's manifest version strands every existing envelope for that key. Land ADR-001 §3.3 TODO(hermes) first.",
    ).toEqual([]);
  });
});

describe("Egress: dataSync reads PII only through the hydrated stores", () => {
  let idb: FakeIndexedDb;

  const options = () => ({
    indexedDb: idb.factory,
    environment: PII_STORE_ENVIRONMENT,
  });

  /** Return the three migrated stores to their empty initial state. */
  function resetStores(): void {
    useHistoryStore.setState({ entries: [] });
    useCustomerStore.setState({ customers: [] });
    useQuoteStore.setState({ quotes: [], nextNumber: 1 });
  }

  beforeEach(async () => {
    idb = createFakeIndexedDb();
    setPiiStoreEnvironment(PII_STORE_ENVIRONMENT);
    setPiiPersistenceDeclined(false);
    setDemoPersistenceSuppressed(false);
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
    resetStores();
    configurePiiStoreRuntime(options());
    await unlockPiiStore(CUSTOMERS, PASS, options());
    await createPiiStore(CUSTOMERS, options()).write(
      `{"state":{"customers":[{"name":"Fernanda Sintética","tag":"${SENTINEL}"}]},"version":1}`,
    );
  });

  afterEach(() => {
    setPiiStoreEnvironment(null);
    setPiiPersistenceDeclined(false);
    setDemoPersistenceSuppressed(false);
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
    resetStores();
    window.localStorage.clear();
  });

  it("an unhydrated vault leaks nothing; the hydrated store is the only egress", async () => {
    // The record exists and is SEALED — a plaintext copy would make this test
    // prove nothing.
    expect(idb.raw("envelopes", CUSTOMERS)).toBeTypeOf("string");

    // Unhydrated: `dataSync` reads the (empty) store, so it cannot reach the
    // vault on its own. The sentinel lives only inside the sealed record.
    const unhydrated = collectSyncData();
    expect(JSON.stringify(unhydrated)).not.toContain(SENTINEL);
    expect(JSON.stringify(unhydrated)).not.toContain("Fernanda");
    expect(unhydrated.customers).toEqual([]);

    // Production precondition: the vault is unlocked, so the stores now
    // rehydrate FROM the vault. The store projection IS collected — that is
    // the HIGH-2 fix — but only as the store's plaintext, never as the sealed
    // record and never as an IndexedDB reference.
    const outcomes = await rehydratePiiStores();
    expect(outcomes.find((outcome) => outcome.key === CUSTOMERS)?.status).toBe(
      "hydrated",
    );

    const hydrated = collectSyncData();
    expect(JSON.stringify(hydrated.customers)).toContain(SENTINEL);
    const serialized = JSON.stringify(hydrated);
    expect(serialized).not.toContain(idb.raw("envelopes", CUSTOMERS) as string);
    expect(serialized).not.toContain(PII_VAULT_KEY);
  });

  it("the vault is absent from the collector's key list, by name", () => {
    const bundle = JSON.stringify(collectSyncData());
    expect(bundle).not.toContain(PII_VAULT_KEY);
  });

  it("dataSync reaches storage only through fixed key literals — never an enumeration", () => {
    // Structural half, pinned so a future `for (const k of something)` cannot
    // quietly widen the egress set to include a surface nobody audited.
    const source = readFileSync(
      resolve(__dirname, "..", "dataSync.ts"),
      "utf8",
    );
    // No IndexedDB access at all: the vault lives there, so this is the
    // structural reason the exclusion holds.
    expect(source).not.toMatch(/indexedDB/);
    // No enumeration of a store: only literal lookups through `guardedStorage`.
    expect(source).not.toMatch(/\.length\s*;?\s*[\s\S]{0,80}localStorage\.key/);
    expect(source).not.toMatch(
      /Object\.(keys|entries|values)\(\s*(window\.)?localStorage/,
    );
    expect(source).not.toMatch(/for\s*\(\s*const\s+\w+\s+in\s+localStorage/);
    // And it does not name the vault at all. (The object-store name
    // `envelopes` is far too generic to assert the absence of in a 40 KB file,
    // so the unambiguous database name is what gets pinned.)
    expect(source).not.toContain(PII_VAULT_KEY);
  });
});
