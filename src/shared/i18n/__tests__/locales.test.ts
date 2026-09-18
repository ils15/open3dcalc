import { describe, it, expect } from "vitest";

import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";

/**
 * Keys the comparison panel emits via `t(...)`. When a key is missing from a
 * locale the button renders the raw key ("stl.compare.add") — an i18n
 * regression users see directly.
 */
const STENCIL_COMPARE_KEYS = [
  "add",
  "title",
  "clear",
  "model",
  "remove",
] as const;

/**
 * D-EA7: chaves que o aviso de integridade da malha emite via `t(...)`. Uma
 * chave ausente faz a UI renderizar a chave crua — regressão visível.
 */
const MESH_WARNING_KEYS = [
  "title",
  "open",
  "winding",
  "nonManifold",
  "degenerate",
  "partial",
  "tooltip",
  "badge",
] as const;

function resolve(dict: unknown, path: string[]): unknown {
  let node: unknown = dict;
  for (const part of path) {
    if (typeof node !== "object" || node === null || !(part in node))
      return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

describe("i18n locales (stl.compare.*)", () => {
  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("resolves every stl.compare.* key in %s", (_locale, dict) => {
    for (const key of STENCIL_COMPARE_KEYS) {
      const value = resolve(dict, ["stl", "compare", key]);
      expect(typeof value, `stl.compare.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });
});

describe("i18n locales (stl.meshWarning.*) — D-EA7", () => {
  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("resolves every stl.meshWarning.* key in %s", (_locale, dict) => {
    for (const key of MESH_WARNING_KEYS) {
      const value = resolve(dict, ["stl", "meshWarning", key]);
      expect(typeof value, `stl.meshWarning.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });
});
