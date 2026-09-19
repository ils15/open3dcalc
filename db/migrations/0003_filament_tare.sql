-- Open3DCalc — Migration 0003: Filament tare (Phase 6 P1 — Wave B)
-- A tara (peso do carretel vazio) agora é persistida por carretel para o
-- cálculo de filamento restante (lib/filamentRemaining). DEFAULT NULL:
-- carretéis legados não a têm e a lib trata ausente = lookup de marca.

ALTER TABLE `filament_spools` ADD COLUMN `tare_grams` REAL DEFAULT NULL;

-- DOWN (rollback, see db/migrate.ts):
--   ALTER TABLE `filament_spools` DROP COLUMN `tare_grams`;
