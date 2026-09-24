import { describe, it, expect } from "vitest";

import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";
import {
  TOUR_IDS,
  isTourAvailable,
} from "@/shared/components/ui/tutorialTours";

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

/**
 * D-CL5: keys the 3D toolpath viewer emits via `t(...)`. A missing key renders
 * the raw key in the loading overlay / toolbar / alerts — a regression users
 * see directly. The staged-progress labels are nested under `stage.*`, one per
 * `ToolpathStage`.
 */
const GCODE_PREVIEW_KEYS = [
  "containerLabel",
  "emptyTitle",
  "emptyDescription",
  "close",
  "fit",
  "parseError",
  "readFailed",
  "tooLarge",
  "tooManyLines",
] as const;

const GCODE_STAGE_KEYS = [
  "reading",
  "parsing",
  "classifying",
  "building-geometry",
  "preparing-gpu",
  "ready",
] as const;

/**
 * D-CL6: keys the layer slider and object-dimensions chip emit via `t(...)`.
 * Interpolated keys are checked with their placeholders resolved (the raw
 * `{{current}}` form is not a usable string), and provenance is asserted on
 * both locales so the honesty tooltip never regresses to a raw key.
 */
const GCODE_LAYER_KEYS = [
  "layerSliderLabel",
  "layerFull",
  "objectDimensions",
  "dimensionsObject",
  "dimensionsExtrusion",
  "dimensionsUnavailable",
] as const;

// `layerValue` is interpolated; verify the placeholder exists instead of the
// literal string, so a locale that drops `{{current}}`/`{{total}}` fails here.
const GCODE_LAYER_VALUE_KEY = "layerValue";
const LAYER_VALUE_PLACEHOLDERS = ["{{current}}", "{{total}}"] as const;

const STL_TOOLPATH_KEYS = ["previewToolpath", "previewToolpathHint"] as const;

describe("i18n locales (gcodePreview.*) — D-CL5", () => {
  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("resolves every gcodePreview.* key in %s", (_locale, dict) => {
    for (const key of GCODE_PREVIEW_KEYS) {
      const value = resolve(dict, ["gcodePreview", key]);
      expect(typeof value, `gcodePreview.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
    for (const key of GCODE_STAGE_KEYS) {
      const value = resolve(dict, ["gcodePreview", "stage", key]);
      expect(typeof value, `gcodePreview.stage.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
    // D-CL6: the layer slider / dimensions chip.
    for (const key of GCODE_LAYER_KEYS) {
      const value = resolve(dict, ["gcodePreview", key]);
      expect(typeof value, `gcodePreview.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
    const layerValue = resolve(dict, ["gcodePreview", GCODE_LAYER_VALUE_KEY]);
    expect(typeof layerValue, "gcodePreview.layerValue").toBe("string");
    for (const placeholder of LAYER_VALUE_PLACEHOLDERS) {
      expect(
        layerValue as string,
        `gcodePreview.layerValue must keep ${placeholder}`,
      ).toContain(placeholder);
    }
    // The StlPreview entry point that opens the viewer.
    for (const key of STL_TOOLPATH_KEYS) {
      const value = resolve(dict, ["stl", key]);
      expect(typeof value, `stl.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });
});

/**
 * Embedded sample loader (3DBenchy, CC0): the empty-state buttons, the
 * download feedback and the fetch-failure toast all emit `stl.samples.*`.
 * A missing key renders the raw key — a regression users see directly.
 */
const STL_SAMPLE_KEYS = ["title", "stl", "gcode", "loading", "error"] as const;

describe("i18n locales (stl.samples.*) — sample loader", () => {
  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("resolves every stl.samples.* key in %s", (_locale, dict) => {
    for (const key of STL_SAMPLE_KEYS) {
      const value = resolve(dict, ["stl", "samples", key]);
      expect(typeof value, `stl.samples.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });
});

/**
 * Wave C (B3): keys the material comparison table emits via `t(...)`. A missing
 * key renders the raw key in the results panel — a regression users see.
 */
const COMPARISON_KEYS = [
  "title",
  "subtitle",
  "toggle",
  "rank",
  "material",
  "density",
  "weight",
  "cost",
  "sortHint",
  "currentMaterial",
  "currentBadge",
  "resinNotComparable",
  "failureRateNote",
  "invalidMaterial",
  "empty",
] as const;

describe("i18n locales (comparison.*) — Wave C B3", () => {
  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("resolves every comparison.* key in %s", (_locale, dict) => {
    for (const key of COMPARISON_KEYS) {
      const value = resolve(dict, ["comparison", key]);
      expect(typeof value, `comparison.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
    // failureRateNote is interpolated; the placeholder must survive.
    const note = resolve(dict, ["comparison", "failureRateNote"]);
    expect(note as string, "comparison.failureRateNote").toContain("{{rate}}");
  });
});

/**
 * Onboarding Fase 1 — chaves do modo demo ("Estúdio Maria Print") emitidas via
 * `t(...)`. O botão de entrada, o indicador persistente e o guard de exportação
 * dependem de todas; uma chave ausente renderiza a chave crua ou deixa um
 * controle sem label acessível — regressão visível e que a parity test deve
 * pegar antes do conteúdo chegar aos JSONs.
 */
const DEMO_BUTTON_KEYS = ["label", "ariaLabel"] as const;

const DEMO_INDICATOR_KEYS = [
  "title",
  "description",
  "exit",
  "exitAriaLabel",
] as const;

const DEMO_EXPORT_KEYS = ["blockedTitle", "badge"] as const;

describe("i18n locales (demo.*) — onboarding Fase 1", () => {
  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("resolves every demo.* key in %s", (_locale, dict) => {
    for (const key of DEMO_BUTTON_KEYS) {
      const value = resolve(dict, ["demo", "button", key]);
      expect(typeof value, `demo.button.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
    for (const key of DEMO_INDICATOR_KEYS) {
      const value = resolve(dict, ["demo", "indicator", key]);
      expect(typeof value, `demo.indicator.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
    for (const key of DEMO_EXPORT_KEYS) {
      const value = resolve(dict, ["demo", "export", key]);
      expect(typeof value, `demo.export.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });
});

/**
 * Onboarding Fase 2 — the tours launcher (header dropdown). It derives its item
 * list from the registry, so the parity test does too: every tour the launcher
 * can render must have a title/description in both locales, or the menu shows a
 * raw key. The set grows as tours are filled in, which is exactly the drift
 * this catches.
 */
const TUTORIAL_LAUNCHER_KEYS = ["title", "completed"] as const;

describe("i18n locales (tutorial.launcher.* + tutorial.tours.*) — Fase 2", () => {
  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])(
    "resolves every launcher key and available tour entry in %s",
    (_locale, dict) => {
      for (const key of TUTORIAL_LAUNCHER_KEYS) {
        const value = resolve(dict, ["tutorial", "launcher", key]);
        expect(typeof value, `tutorial.launcher.${key}`).toBe("string");
        expect((value as string).length).toBeGreaterThan(0);
      }

      for (const tourId of TOUR_IDS.filter(isTourAvailable)) {
        for (const field of ["title", "description"] as const) {
          const value = resolve(dict, ["tutorial", "tours", tourId, field]);
          expect(typeof value, `tutorial.tours.${tourId}.${field}`).toBe(
            "string",
          );
          expect((value as string).length).toBeGreaterThan(0);
        }
      }
    },
  );
});

/**
 * W4 — the guided wizard. Every label / button / error the 4-step flow emits goes
 * through `t("wizard.*")`; a missing key renders the raw string in the step body
 * or leaves a control without an accessible label. Keys are nested by surface
 * (steps.*, fields.*, nav.*, result.*, errors.*) to mirror the component tree.
 */
const WIZARD_STEP_KEYS = ["title", "description"] as const;
const WIZARD_STEP_IDS = ["1", "2", "3", "4"] as const;

const WIZARD_FIELD_LABEL_KEYS = [
  "productName",
  "materialType",
  "weightGrams",
  "costPerKg",
  "quantity",
  "printer",
  "printTimeHours",
  "energyCostPerKwh",
  "setupTimeMinutes",
  "postProcessingMinutes",
  "hourlyRate",
  "packagingCost",
  "profitMarginPercent",
] as const;

const WIZARD_UNIT_KEYS = [
  "weightGrams",
  "costPerKg",
  "printTimeHours",
  "energyCostPerKwh",
  "setupTimeMinutes",
  "postProcessingMinutes",
  "hourlyRate",
  "packagingCost",
  "profitMarginPercent",
] as const;

const WIZARD_ERROR_KINDS = ["required", "positive", "minQuantity"] as const;

describe("i18n locales (wizard.*) — W4 guided wizard", () => {
  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("resolves every wizard.* key in %s", (_locale, dict) => {
    for (const key of ["title", "subtitle", "regionLabel"] as const) {
      const value = resolve(dict, ["wizard", key]);
      expect(typeof value, `wizard.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }

    // Interpolated progress label — placeholders must survive.
    const stepOf = resolve(dict, ["wizard", "stepOf"]);
    expect(typeof stepOf, "wizard.stepOf").toBe("string");
    expect(stepOf as string, "wizard.stepOf").toContain("{{current}}");
    expect(stepOf as string, "wizard.stepOf").toContain("{{total}}");

    for (const step of WIZARD_STEP_IDS) {
      for (const key of WIZARD_STEP_KEYS) {
        const value = resolve(dict, ["wizard", "steps", step, key]);
        expect(typeof value, `wizard.steps.${step}.${key}`).toBe("string");
        expect((value as string).length).toBeGreaterThan(0);
      }
    }

    for (const field of WIZARD_FIELD_LABEL_KEYS) {
      const label = resolve(dict, ["wizard", "fields", field, "label"]);
      expect(typeof label, `wizard.fields.${field}.label`).toBe("string");
      expect((label as string).length).toBeGreaterThan(0);
    }

    // Numeric fields carry a unit suffix; the placeholder hints at slicer output.
    for (const field of WIZARD_UNIT_KEYS) {
      const unit = resolve(dict, ["wizard", "fields", field, "unit"]);
      expect(typeof unit, `wizard.fields.${field}.unit`).toBe("string");
      expect((unit as string).length).toBeGreaterThan(0);
    }
    const placeholder = resolve(dict, [
      "wizard",
      "fields",
      "productName",
      "placeholder",
    ]);
    expect(typeof placeholder, "wizard.fields.productName.placeholder").toBe(
      "string",
    );

    for (const key of ["previous", "next", "finish", "exit"] as const) {
      const value = resolve(dict, ["wizard", "nav", key]);
      expect(typeof value, `wizard.nav.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }

    for (const key of [
      "title",
      "totalCost",
      "sellPrice",
      "profit",
      "marginLabel",
      "ctaClassic",
      "ctaHint",
    ] as const) {
      const value = resolve(dict, ["wizard", "result", key]);
      expect(typeof value, `wizard.result.${key}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }

    for (const kind of WIZARD_ERROR_KINDS) {
      const value = resolve(dict, ["wizard", "errors", kind]);
      expect(typeof value, `wizard.errors.${kind}`).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });
});

/**
 * Currency-symbol leak guard. The app resolves the currency symbol at runtime
 * via `useCurrency()` → `Intl.NumberFormat`, so an en-US label must never hold
 * a literal "R$" — otherwise USD/EUR/GBP users see the Brazilian real no matter
 * which currency they select.
 *
 * Excluded by design:
 *  - `changelog.versions[]`: a factual release record, never re-localized.
 *  - Brazilian-market guidance that deliberately cites real BRL prices
 *    (e.g. filament price ranges). Intentional local references.
 */
const BRL_REALITY_ALLOWLIST = new Set<string>([
  "tooltip.costPerKg", // "PLA ~R$90, PETG ~R$110 …" — BR market guidance
]);

function collectStrings(
  node: unknown,
  path: string[],
  out: { key: string; value: string }[],
): void {
  if (typeof node === "string") {
    out.push({ key: path.join("."), value: node });
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      collectStrings(v, [...path, k], out);
    }
  }
}

describe("i18n locales — multi-material disabled explanation", () => {
  it.each([
    [
      "pt-BR",
      ptBR,
      "Em desenvolvimento: o custo dos materiais múltiplos ainda não entra no subtotal, custo total, preço de venda ou lucro. O recurso fica indisponível nesta beta para evitar um preço incorreto.",
    ],
    [
      "en-US",
      enUS,
      "In development: multi-material cost is not yet included in the subtotal, total cost, sell price, or profit. The feature is unavailable in this beta to avoid an incorrect price.",
    ],
  ])("has the same explanation key in %s", (locale, dict, expected) => {
    const value = resolve(dict, ["calc", "multiMaterialDisabledDescription"]);
    expect(typeof value, `calc.multiMaterialDisabledDescription (${locale})`).toBe(
      "string",
    );
    expect(value).toBe(expected);
  });
});

describe("i18n locales — no hardcoded currency symbol (R$) in en-US", () => {
  it("en-US labels never hardcode R$; the symbol comes from useCurrency()", () => {
    const all: { key: string; value: string }[] = [];
    collectStrings(enUS, [], all);

    const offenders = all.filter(
      (entry) =>
        entry.value.includes("R$") &&
        !entry.key.startsWith("changelog.versions") &&
        !BRL_REALITY_ALLOWLIST.has(entry.key),
    );

    expect(offenders.map((entry) => `${entry.key} = ${entry.value}`)).toEqual(
      [],
    );
  });
});
