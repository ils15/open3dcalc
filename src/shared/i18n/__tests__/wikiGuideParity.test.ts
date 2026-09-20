import { describe, it, expect } from "vitest";

import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";
import { SECTIONS } from "@/shared/components/Calculator/Calculator.constants";
import { TUTORIAL_TABS } from "@/shared/components/ui/tutorialTours";

/**
 * The wiki/guide surface (Fase 3, U6) indexes one card per app area. Each card
 * renders `guide.<area>.{title,description,cta}` — a missing key or an empty
 * string renders the raw key (or a blank card), a regression users see. Both
 * locales must stay in lockstep: a locale that lags behind silently ships a
 * half-translated guide.
 */

/**
 * The top-level tabs the guide indexes — derived from the tutorial registry
 * itself, not duplicated here. A tab added to `TUTORIAL_TABS` (the same list
 * the tab parity gate keeps in sync with the app `TABS`) without its
 * `guide.<tab>.*` keys now fails this gate instead of silently dropping out of
 * (or silently entering) the drawer's index.
 */
const GUIDE_TAB_AREAS = TUTORIAL_TABS;

/**
 * The calculator sections the guide indexes — mirrored from the live
 * `SECTIONS` registry so a section added there without i18n keys fails here.
 */
const GUIDE_SECTION_AREAS = SECTIONS.map((section) => section.id);

const GUIDE_AREAS = [...GUIDE_TAB_AREAS, ...GUIDE_SECTION_AREAS];

const GUIDE_FIELDS = ["title", "description", "cta"] as const;

function resolve(dict: unknown, path: string[]): unknown {
  let node: unknown = dict;
  for (const part of path) {
    if (typeof node !== "object" || node === null || !(part in node))
      return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

describe("i18n locales (guide.*) — wiki guide surface", () => {
  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("resolves every guide area in %s", (_locale, dict) => {
    expect(GUIDE_AREAS.length, "expected every tab and section to be a guide area").toBe(
      GUIDE_TAB_AREAS.length + GUIDE_SECTION_AREAS.length,
    );
    for (const area of GUIDE_AREAS) {
      for (const field of GUIDE_FIELDS) {
        const value = resolve(dict, ["guide", area, field]);
        expect(typeof value, `guide.${area}.${field}`).toBe("string");
        expect(
          (value as string).trim().length,
          `guide.${area}.${field} must not be empty`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("exposes no guide area in one locale that the other lacks", () => {
    const ptAreas = Object.keys(ptBR.guide ?? {});
    const enAreas = Object.keys(enUS.guide ?? {});
    expect(new Set(ptAreas), "pt-BR-only guide areas").toEqual(
      new Set(enAreas),
    );
  });

  it("covers every id in the SECTIONS registry", () => {
    const areas = Object.keys(ptBR.guide ?? {});
    for (const id of GUIDE_SECTION_AREAS) {
      expect(areas.includes(id), `SECTIONS id "${id}" has no guide.* key`).toBe(
        true,
      );
    }
  });
});

describe("i18n locales (nav.wiki) — wiki tab label", () => {
  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("resolves nav.wiki in %s", (_locale, dict) => {
    const value = resolve(dict, ["nav", "wiki"]);
    expect(typeof value, "nav.wiki").toBe("string");
    expect(
      (value as string).trim().length,
      "nav.wiki must not be empty",
    ).toBeGreaterThan(0);
  });
});
