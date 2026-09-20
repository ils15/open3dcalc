import { SECTIONS } from "@/shared/components/Calculator/Calculator.constants";
import {
  TUTORIAL_TABS,
  isTourAvailable,
  type TourId,
} from "@/shared/components/ui/tutorialTours";

/**
 * The guide indexes one card per app surface: the 11 top-level tabs plus the 10
 * calculator sections. Both lists are the live registries (the tutorial engine's
 * tab list and the calculator's section config), so a surface added anywhere is
 * a guide area the moment it ships — and the i18n parity gate (`guide.*` keys)
 * fails until it is translated.
 */
export const GUIDE_TAB_AREAS: readonly string[] = TUTORIAL_TABS;

export const GUIDE_SECTION_AREAS: string[] = SECTIONS.map((section) => section.id);

export const GUIDE_AREAS: string[] = [
  ...GUIDE_TAB_AREAS,
  ...GUIDE_SECTION_AREAS,
];

/**
 * Which tours walk a given area. The calculator surface owns two (the basic
 * walkthrough and the 3D upload preview), so its card offers a picker rather
 * than a single launch.
 *
 * Tours are hidden until they have registered steps — an empty registry entry
 * (the U8/U9 tours) renders no CTA, so this table can list a tour before its
 * content exists without shipping a dead button.
 */
const AREA_TOURS: Record<string, TourId[]> = {
  calculator: ["calc-basico", "upload-3d-preview"],
  inventory: ["inventario-bobinas"],
  dashboard: ["dashboard-kpis"],
};

/** Tours registered with steps for this area — empty when the area has none. */
export function getAreaTours(area: string): TourId[] {
  return (AREA_TOURS[area] ?? []).filter(isTourAvailable);
}

/** True when the area has at least one tour ready to run. */
export function isAreaTourAvailable(area: string): boolean {
  return getAreaTours(area).length > 0;
}
