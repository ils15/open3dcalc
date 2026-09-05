-- Open3DCalc — Migration 0002: Product inventory (Issue #68)
-- Standalone product catalog: name, weight, filament, cost/sale price,
-- manual sold flag. No foreign keys (YAGNI — products are self-contained).

CREATE TABLE `products` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `name` TEXT NOT NULL,
  `weight_grams` REAL DEFAULT 0,
  `filament_type` TEXT DEFAULT '',
  `cost_price` REAL DEFAULT 0,
  `sale_price` REAL DEFAULT 0,
  `sold` INTEGER DEFAULT 0,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL
);

CREATE INDEX `idx_products_name` ON `products` (`name`);
CREATE INDEX `idx_products_sold` ON `products` (`sold`);

-- DOWN (rollback, see db/migrate.ts):
--   DROP TABLE IF EXISTS `products`;
