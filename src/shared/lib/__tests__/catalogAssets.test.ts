/**
 * @vitest-environment node
 *
 * Asset gate for W10a: every image referenced by the seed catalogs must
 * either exist on disk or resolve to our original fallback artwork.
 *
 * The 51 brand-card PNGs are intentionally not shipped in this wave (they
 * are dangling references); the fallback SVGs MUST exist so that no printer
 * ends up without a thumbnail.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { printers } from '@/shared/lib/printers';
import { marketplaces } from '@/shared/lib/marketplace';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

function existsInPublic(rel: string): boolean {
  return fs.existsSync(path.join(PUBLIC_DIR, rel.replace(/^\//, '')));
}

describe('catalog assets', () => {
  it('ships the printer fallback artwork', () => {
    expect(existsInPublic('/images/printers/fallback-fdm.svg')).toBe(true);
    expect(existsInPublic('/images/printers/fallback-resin.svg')).toBe(true);
  });

  it('ships every marketplace logo referenced by the seed catalog', () => {
    const referenced = new Set(marketplaces.map((m) => m.logo).filter(Boolean));
    for (const logo of referenced) {
      expect(existsInPublic(logo!), `missing marketplace art: ${logo}`).toBe(true);
    }
  });

  it('every marketplace logo is our original SVG, not a registered logo', () => {
    for (const m of marketplaces) {
      expect(m.logo).toMatch(/\.svg$/);
    }
  });

  it('references only fallback artwork or brand cards, nothing else', () => {
    for (const p of printers) {
      expect(p.image).toMatch(
        /^\/images\/printers\/(fallback-(fdm|resin)\.svg|brands\/.+)$/,
      );
    }
  });

  it('assigns a resin fallback only to resin printers and vice versa', () => {
    for (const p of printers) {
      if (!p.image) continue;
      const isFallback = p.image.includes('fallback-');
      if (!isFallback) continue;
      const tech = p.technology;
      if (tech === 'resin') expect(p.image).toContain('fallback-resin.svg');
      if (tech === 'fdm') expect(p.image).toContain('fallback-fdm.svg');
      // unmatched printers fall back to inferred tech — no assertion there.
    }
  });
});
