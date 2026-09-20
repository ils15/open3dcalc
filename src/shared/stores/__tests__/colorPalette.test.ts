import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useColorPalette,
  COLOR_PALETTE_KEY,
} from "../colorPalette";

/**
 * Bloco 1 — store da paleta custom.
 *
 * A key `open3dcalc_color_palette_v1` precisa estar registrada no fixture
 * SPEC-01; caso contrário o gate do guardedStorage lança ManifestError em
 * dev (e descarta a escrita em produção) e estes testes falham.
 */

describe("useColorPalette (integration)", () => {
  beforeEach(() => {
    localStorage.clear();
    useColorPalette.setState({ colors: [] });
  });

  // ── addColor ───────────────────────────────────────────────
  it("addColor() → cor aparece na lista com id", () => {
    useColorPalette.getState().addColor("Verde Neon", "#22ff00");

    const { colors } = useColorPalette.getState();
    expect(colors).toHaveLength(1);
    expect(colors[0].name).toBe("Verde Neon");
    expect(colors[0].hex).toBe("#22ff00");
    expect(colors[0].id).toBeTruthy();
  });

  it("addColor() persiste para localStorage na key registrada", () => {
    useColorPalette.getState().addColor("Roxo Metálico", "#a855f7");

    const raw = JSON.parse(localStorage.getItem(COLOR_PALETTE_KEY) || "[]");
    expect(raw).toHaveLength(1);
    expect(raw[0].name).toBe("Roxo Metálico");
    expect(raw[0].hex).toBe("#a855f7");
  });

  it("addColor() com nome vazio é no-op (não persiste lixo)", () => {
    useColorPalette.getState().addColor("   ", "#22ff00");

    expect(useColorPalette.getState().colors).toHaveLength(0);
    expect(localStorage.getItem(COLOR_PALETTE_KEY)).toBeNull();
  });

  it("addColor() sem hex usa fallback padrão", () => {
    useColorPalette.getState().addColor("Cor Genérica", "");

    expect(useColorPalette.getState().colors[0].hex).toBe("#6366f1");
  });

  // ── removeColor ────────────────────────────────────────────
  it("removeColor() remove a cor e persiste", () => {
    useColorPalette.getState().addColor("Verde Neon", "#22ff00");
    useColorPalette.getState().addColor("Roxo Metálico", "#a855f7");
    const id = useColorPalette.getState().colors[0].id;

    useColorPalette.getState().removeColor(id);

    const { colors } = useColorPalette.getState();
    expect(colors).toHaveLength(1);
    expect(colors[0].name).toBe("Roxo Metálico");

    const raw = JSON.parse(localStorage.getItem(COLOR_PALETTE_KEY) || "[]");
    expect(raw).toHaveLength(1);
    expect(raw[0].name).toBe("Roxo Metálico");
  });

  it("removeColor() com id inexistente não altera a lista", () => {
    useColorPalette.getState().addColor("Verde Neon", "#22ff00");

    useColorPalette.getState().removeColor("id_inexistente");

    expect(useColorPalette.getState().colors).toHaveLength(1);
  });

  // ── migration-on-load ──────────────────────────────────────
  it("recarrega a paleta persistida numa instância nova (reload)", () => {
    useColorPalette.getState().addColor("Verde Neon", "#22ff00");
    useColorPalette.getState().addColor("Laranja Fluorescente", "#ff7f00");
    expect(localStorage.getItem(COLOR_PALETTE_KEY)).not.toBeNull();

    // Simula um reload: localStorage continua, módulo é re-avaliado.
    vi.resetModules();
    return import("../colorPalette").then(({ useColorPalette: fresh }) => {
      const { colors } = fresh.getState();
      expect(colors).toHaveLength(2);
      expect(colors.map((c) => c.name).sort()).toEqual([
        "Laranja Fluorescente",
        "Verde Neon",
      ]);
      expect(colors.map((c) => c.hex).sort()).toEqual(["#22ff00", "#ff7f00"]);
    });
  });

  it("payload legacy sem hex carrega com fallback (default-on-missing)", () => {
    localStorage.setItem(
      COLOR_PALETTE_KEY,
      JSON.stringify([{ id: "legacy_1", name: "Cor Velha" }]),
    );

    vi.resetModules();
    return import("../colorPalette").then(({ useColorPalette: fresh }) => {
      const { colors } = fresh.getState();
      expect(colors).toHaveLength(1);
      expect(colors[0].name).toBe("Cor Velha");
      expect(colors[0].hex).toBe("#6366f1");
    });
  });

  it("payload corrompido/nao-array carrega como paleta vazia", () => {
    localStorage.setItem(COLOR_PALETTE_KEY, "{not an array");

    vi.resetModules();
    return import("../colorPalette").then(({ useColorPalette: fresh }) => {
      expect(fresh.getState().colors).toHaveLength(0);
    });
  });
});
