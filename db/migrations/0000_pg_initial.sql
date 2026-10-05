CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calculator_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"state_json" jsonb NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_marketplaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"fee_percent" real NOT NULL,
	"fee_fixed" real NOT NULL,
	"has_free_shipping" boolean DEFAULT false,
	"shipping_fee_percent" real,
	"custom" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "catalog_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"density" real NOT NULL,
	"avg_price" real NOT NULL,
	"type" text NOT NULL,
	"custom" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "catalog_printers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"power" real NOT NULL,
	"value" real NOT NULL,
	"useful_life" integer NOT NULL,
	"maintenance_per_hour" real NOT NULL,
	"image" text,
	"max_filaments" integer,
	"custom" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"email" text,
	"phone" text,
	"address" text,
	"notes" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filament_spools" (
	"id" text PRIMARY KEY NOT NULL,
	"brand" text DEFAULT '',
	"material" text DEFAULT 'PLA',
	"color" text DEFAULT '',
	"color_hex" text DEFAULT '',
	"weight_grams" real DEFAULT 0,
	"original_weight_grams" real DEFAULT 1000,
	"cost_per_kg" real DEFAULT 0,
	"diameter_mm" real DEFAULT 1.75,
	"date_added" integer NOT NULL,
	"notes" text DEFAULT '',
	"status" text DEFAULT 'in_stock',
	"purchase_store" text DEFAULT '',
	"tare_grams" real
);
--> statement-breakpoint
CREATE TABLE "history_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" integer NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"summary" text DEFAULT '',
	"total_cost" real DEFAULT 0,
	"sell_price" real DEFAULT 0,
	"profit" real DEFAULT 0,
	"result_json" jsonb NOT NULL,
	"snapshot_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "legacy_residue" (
	"key" text PRIMARY KEY NOT NULL,
	"shape" text NOT NULL,
	"blob" text NOT NULL,
	"recovered_value_sha" text NOT NULL,
	"recovered_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pii_stage" (
	"transaction_id" text NOT NULL,
	"generation" integer NOT NULL,
	"privacy_epoch" integer NOT NULL,
	"schema_version" integer NOT NULL,
	"envelope_version" integer NOT NULL,
	"state" text NOT NULL,
	"blob" text NOT NULL,
	"created_at" integer NOT NULL,
	PRIMARY KEY ("transaction_id", "generation")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"weight_grams" real DEFAULT 0,
	"filament_type" text DEFAULT '',
	"cost_price" real DEFAULT 0,
	"sale_price" real DEFAULT 0,
	"sold" boolean DEFAULT false,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"history_entry_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1,
	"unit_price" real DEFAULT 0,
	"total_price" real DEFAULT 0,
	"discount_percent" real DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"customer_id" text,
	"customer_snapshot" jsonb,
	"global_discount_percent" real DEFAULT 0,
	"subtotal" real DEFAULT 0,
	"discount_amount" real DEFAULT 0,
	"total" real DEFAULT 0,
	"status" text DEFAULT 'draft',
	"valid_until" text NOT NULL,
	"payment_terms" text DEFAULT '',
	"delivery_estimate" text DEFAULT '',
	"footer_note" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"exported_at" integer,
	CONSTRAINT "quotes_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "storage" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;