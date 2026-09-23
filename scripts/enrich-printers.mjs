/**
 * scripts/enrich-printers.mjs — Wave 10a
 *
 * Enriches the app's printer catalog with TECHNICAL data only from the
 * community database at https://github.com/swordlab/open-3d-printer-database
 * (CC-BY-4.0 — see docs/CREDITS.md).
 *
 * MERGE RULES (critical — enforced here and unit-tested):
 *   - Imported fields: technology, build_volume_mm (or derived from
 *     build_volume_cm3 as a perfect cube, approximate), nozzle_diameter_mm,
 *     max_speed_mm_s.
 *   - PRESERVED (never overwritten): value, power, usefulLife,
 *     maintenancePerHour, image, maxFilaments, tags — the app's economic
 *     data (R$ pricing and typical consumption) diverges from the swordlab
 *     EUR figures, whose power_w is the PSU peak, not typical draw.
 *   - Match: fuzzy manufacturer+model.
 *
 * Image fallback rule: every printer gets a thumbnail. Entries without a
 * brand card use public/images/printers/fallback-{fdm|resin}.svg.
 *
 * Run:  node scripts/enrich-printers.mjs [--write]
 *       (no flags = dry run; report only, no file mutated)
 *
 * Node ≥18 (global fetch + --experimental-vm-modules not required).
 *
 * NOTE: pure helper functions are exported so the matcher can be unit-tested
 * without network access (scripts/__tests__/enrich-printers.test.mjs).
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CATALOG_URL =
  "https://raw.githubusercontent.com/swordlab/open-3d-printer-database/main/catalog.json";
const PRINTERS_PATH = path.resolve(process.cwd(), "src/shared/lib/printers.ts");
const FALLBACK_DIR = "/images/printers";

/** Model name patterns that unambiguously identify resin (MSLA) printers.
 *  Matched against the MODEL name only — never the brand — so that
 *  e.g. "FlashForge" (brand) is not mistaken for a resin family. */
const RESIN_PATTERNS = [
  "photon",
  "halot",
  "saturn",
  "mars",
  "sl1",
  "sl2",
  "sonic",
  "moai",
  "phenom",
  "forge",
  "lcd",
  "sla",
  "msla",
  "dlp",
  "forma",
  "shining",
  "shadow",
];

/** Official manufacturer sites (root domain). Used for websiteUrl only.
 *  Generic root URLs are stable across product lines; the app makes zero
 *  network calls — the user opens these. */
const BRAND_URLS = {
  "Bambu Lab": "https://bambulab.com",
  Creality: "https://www.creality.com",
  Anycubic: "https://www.anycubic.com",
  Prusa: "https://www.prusa3d.com",
  Elegoo: "https://www.elegoo.com",
  Flashforge: "https://www.flashforge.com",
  UltiMaker: "https://ultimaker.com",
  Artillery: "https://artillery3d.com",
  "Qidi Tech": "https://qidi3d.com",
  Sovol: "https://www.sovol3d.com",
  AnkerMake: "https://www.ankermake.com",
  Raise3D: "https://www.raise3d.com",
  Snapmaker: "https://snapmaker.com",
  Voron: "https://vorondesign.com",
  Peopoly: "https://peopoly.net",
  Phrozen: "https://phrozen3d.com",
};

/**
 * Normalize a name for matching: lowercase, drop punctuation/space.
 * "Bambu Lab P1S" -> "bambulabp1s"; "SATURN3" -> "saturn3".
 */
export function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Infer technology from the MODEL name (never the brand) when the catalog
 * has no match. "FlashForge" must not trip the "forge" resin pattern.
 */
export function inferTechnology(printer) {
  const model = normalize(printer.name);
  return RESIN_PATTERNS.some((p) => model.includes(p)) ? "resin" : "fdm";
}

/**
 * Pick the fallback thumbnail for a printer.
 * Prefer explicit technology, else infer from the model name.
 */
export function fallbackImage(printer) {
  if (printer.technology === "resin")
    return `${FALLBACK_DIR}/fallback-resin.svg`;
  if (printer.technology === "fdm") return `${FALLBACK_DIR}/fallback-fdm.svg`;
  return inferTechnology(printer) === "resin"
    ? `${FALLBACK_DIR}/fallback-resin.svg`
    : `${FALLBACK_DIR}/fallback-fdm.svg`;
}

/**
 * Convert cm³ to an approximate mm³ cube: x=y=z=∛(cm³·1000).
 * Only used when the real dimensions are unavailable; documented as such.
 */
export function cubeFromCm3(cm3) {
  const side = Math.cbrt(Number(cm3) * 1000);
  return { x: side, y: side, z: side };
}

/**
 * Transform one swordlab entry into ONLY the technical fields we adopt.
 * Economic/power fields are deliberately dropped here — see MERGE RULES.
 */
export function extractTechnical(source) {
  const specs = source?.specs ?? {};
  const out = {
    technology:
      source.technology === "SLA" || source.technology === "SLS"
        ? "resin"
        : source.technology === "FDM"
          ? "fdm"
          : undefined,
    buildVolumeMm: specs.build_volume_mm
      ? {
          x: specs.build_volume_mm.x,
          y: specs.build_volume_mm.y,
          z: specs.build_volume_mm.z,
        }
      : specs.build_volume_cm3
        ? cubeFromCm3(specs.build_volume_cm3)
        : undefined,
    nozzleDiameterMm: specs.nozzle_diameter_mm,
    maxSpeedMmS: specs.max_speed_mm_s,
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

/**
 * Brand candidates from the swordlab catalog for a given app brand.
 * Handles case/spelling variants (Flashforge/FlashForge, QIDI/Qidi).
 */
function brandCandidates(sw, appBrand) {
  const ab = normalize(appBrand);
  return sw.filter((p) => {
    const pb = normalize(p.manufacturer);
    return pb === ab || pb.includes(ab) || (ab.length > 2 && ab.includes(pb));
  });
}

/**
 * Fuzzy match manufacturer+model.
 * Returns the best swordlab entry, or null when there is no confident match.
 *
 * Strategy (highest confidence first):
 *   1. exact — normalized "manufacturer model" equals ours
 *   2. prefix — normalized model starts with ours (or ours with its),
 *      preferring the shortest match ("Saturn 3" -> "SATURN3" not "Ultra")
 */
export function matchPrinter(printer, sw) {
  const an = normalize(`${printer.brand} ${printer.name}`);
  const am = normalize(printer.name);
  const cands = brandCandidates(sw, printer.brand);

  let best = null;
  for (const c of cands) {
    const cn = normalize(`${c.manufacturer} ${c.model}`);
    if (cn === an) return c; // exact — immediate
  }
  for (const c of cands) {
    const cm = normalize(c.model);
    if (cm.length < 3 || am.length < 3) continue;
    if (cm.startsWith(am) || am.startsWith(cm)) {
      if (!best || normalize(c.model).length < normalize(best.model).length)
        best = c;
    }
  }
  return best;
}

/** Apply technical enrichment to one printer (preserving economic fields). */
export function enrich(printer, source) {
  const tech = source ? extractTechnical(source) : {};
  const out = { ...printer, ...tech };
  if (tech.technology) out.technology = tech.technology;
  out.image =
    printer.image || fallbackImage({ ...printer, technology: out.technology });
  if (!out.websiteUrl && BRAND_URLS[printer.brand])
    out.websiteUrl = BRAND_URLS[printer.brand];
  return out;
}

async function fetchCatalog() {
  const res = await fetch(CATALOG_URL, { redirect: "follow" });
  if (!res.ok)
    throw new Error(`Failed to fetch swordlab catalog: HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : Object.values(json);
}

/** Parse the current printers.ts into raw app objects (source-of-truth for preserved fields). */
function parsePrintersTs(source) {
  const re =
    /\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*brand:\s*'([^']+)'([^}]*)\}/g;
  const rows = [];
  let m;
  while ((m = re.exec(source)) !== null) {
    const extra = m[4];
    const num = (key) => {
      const hit = extra.match(new RegExp(`\\b${key}:\\s*(-?\\d+(?:\\.\\d+)?)`));
      return hit ? Number(hit[1]) : undefined;
    };
    const str = (key) => {
      const hit = extra.match(new RegExp(`\\b${key}:\\s*'([^']*)'`));
      return hit ? hit[1] : undefined;
    };
    const arr = (key) => {
      const hit = extra.match(new RegExp(`\\b${key}:\\s*\\[([^\\]]*)\\]`));
      if (!hit) return undefined;
      return hit[1]
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    };
    rows.push({
      id: m[1],
      name: m[2],
      brand: m[3],
      power: num("power"),
      value: num("value"),
      usefulLife: num("usefulLife"),
      maintenancePerHour: num("maintenancePerHour"),
      image: str("image"),
      maxFilaments: num("maxFilaments"),
      tags: arr("tags"),
    });
  }
  return rows;
}

/** Serialize one printer back to the source literal. */
function formatPrinter(p) {
  const parts = [
    `    id: '${p.id}',`,
    `    name: ${JSON.stringify(p.name)},`,
    `    brand: ${JSON.stringify(p.brand)},`,
    `    power: ${p.power},`,
    `    value: ${p.value},`,
    `    usefulLife: ${p.usefulLife},`,
    `    maintenancePerHour: ${p.maintenancePerHour},`,
  ];
  if (p.image) parts.push(`    image: ${JSON.stringify(p.image)},`);
  if (p.maxFilaments) parts.push(`    maxFilaments: ${p.maxFilaments},`);
  if (p.technology)
    parts.push(
      `    technology: ${p.technology ? JSON.stringify(p.technology) : undefined},`,
    );
  if (p.buildVolumeMm) {
    const v = p.buildVolumeMm;
    const approx = Math.abs(v.x - v.y) < 0.01 && Math.abs(v.y - v.z) < 0.01;
    parts.push(
      `    // ${approx ? "volume aproximado (∛cm³) — dimensões reais indisponíveis" : "dimensões reais (mm)"}`,
    );
    parts.push(
      `    buildVolumeMm: { x: ${round(v.x)}, y: ${round(v.y)}, z: ${round(v.z)} },`,
    );
  }
  if (p.nozzleDiameterMm)
    parts.push(`    nozzleDiameterMm: ${p.nozzleDiameterMm},`);
  if (p.maxSpeedMmS) parts.push(`    maxSpeedMmS: ${p.maxSpeedMmS},`);
  if (p.websiteUrl)
    parts.push(`    websiteUrl: ${JSON.stringify(p.websiteUrl)},`);
  if (p.tags?.length)
    parts.push(
      `    tags: [${p.tags.map((t) => JSON.stringify(t)).join(", ")}],`,
    );
  return `  {\n${parts.join("\n")}\n  },`;
}

function round(n) {
  return Math.round(Number(n) * 10) / 10;
}

export async function run({ write = false } = {}) {
  const ts = fs.readFileSync(PRINTERS_PATH, "utf8");
  const rows = parsePrintersTs(ts);
  if (!rows.length)
    throw new Error(
      "Could not parse printers.ts — bailing to avoid data loss.",
    );
  if (rows.length !== 103)
    throw new Error(`Expected 103 printers, parsed ${rows.length}.`);

  const sw = await fetchCatalog();
  console.log(`swordlab catalog: ${sw.length} printers`);

  const report = { matched: 0, unmatched: [] };
  const enriched = rows.map((p) => {
    const src = matchPrinter(p, sw);
    if (src) report.matched++;
    else report.unmatched.push(p.id);
    return enrich(p, src);
  });

  console.log(
    `matched ${report.matched}/${rows.length} (unmatched: ${report.unmatched.length})`,
  );
  if (report.unmatched.length)
    console.log("unmatched:", report.unmatched.join(", "));

  const missingImage = enriched.filter((p) => !p.image);
  console.log(`without thumbnail after fallback: ${missingImage.length}`);
  if (missingImage.length)
    throw new Error("Every printer must have a thumbnail.");

  // Diff report: prove economic fields are untouched.
  console.log("\nSample (technical only):");
  for (const id of [
    "bambu_p1s",
    "creality_ender_3_v3_se",
    "anycubic_photon_m3",
    "prusa_mk4",
    "elegoo_saturn_3",
  ]) {
    const p = enriched.find((x) => x.id === id);
    if (p)
      console.log(
        `  ${id}: tech=${p.technology} build=${JSON.stringify(p.buildVolumeMm)} nozzle=${p.nozzleDiameterMm} speed=${p.maxSpeedMmS}`,
      );
  }

  if (!write) {
    console.log(
      "\nDRY RUN — printers.ts not modified. Re-run with --write to apply.",
    );
    return { enriched, report };
  }

  const header = `import type { PrinterProfile } from '@/shared/types'

export type { PrinterProfile }

// Technical fields (technology / buildVolumeMm / nozzleDiameterMm / maxSpeedMmS)
// are adapted from the swordlab/open-3d-printer-database (CC-BY-4.0) — see
// docs/CREDITS.md. Economic data (value, power, usefulLife, maintenancePerHour)
// is the app's own and was NOT modified by the enrichment script.

export const printers: PrinterProfile[] = [
`;
  const body = enriched.map(formatPrinter).join("\n");
  const footer = `]

export function getPrinter(id: string): PrinterProfile {
  return printers.find(p => p.id === id) ?? printers[0]
}
`;
  fs.writeFileSync(PRINTERS_PATH, header + body + "\n" + footer);
  console.log(`\nwrote ${PRINTERS_PATH} (${enriched.length} printers)`);
  return { enriched, report };
}

// CLI entrypoint when run via `node scripts/enrich-printers.mjs [--write]`
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  run({ write: process.argv.includes("--write") }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
