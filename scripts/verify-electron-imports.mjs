#!/usr/bin/env node
// Validation: checks that no compiled .js file has a bare directory import
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "electron", "dist");
let errors = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      walk(join(dir, entry.name));
    } else if (entry.name.endsWith(".js")) {
      const content = readFileSync(join(dir, entry.name), "utf-8");
      const relPath = join(dir, entry.name).replace(
        distDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "",
      );

      // Check for `from './something'` or `from '../something'`
      const importMatches = content.match(/from\s+['"](\.[^'"]+)['"]/g) || [];
      for (const imp of importMatches) {
        const path = imp.match(/['"](\.[^'"]+)['"]/)?.[1];
        if (
          path &&
          !path.endsWith(".js") &&
          !path.endsWith(".mjs") &&
          !path.endsWith(".cjs") &&
          !path.endsWith(".json") &&
          !path.endsWith(".node")
        ) {
          const resolved = join(dirname(join(distDir, relPath)), path);
          try {
            if (statSync(resolved).isDirectory()) {
              console.error(
                `\u274C ${relPath}: bare directory import '${path}'`,
              );
              errors++;
            }
          } catch {
            // If path doesn't exist, that's a separate issue
          }
        }
      }
    }
  }
}

if (!existsSync(distDir)) {
  console.error(`\u274C Compiled output not found: ${distDir}`);
  console.error("Run `npm run build:electron` first.");
  process.exit(1);
}
walk(distDir);
if (errors) {
  console.error(`\n${errors} ESM directory imports found. Aborting.`);
  process.exit(1);
} else {
  console.log("\u2705 All ESM imports in compiled output are valid.");
}
