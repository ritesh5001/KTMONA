-- Global key-value store for admin-configurable platform settings
-- (e.g. whether the shipping charge is currently applied to orders).
CREATE TABLE IF NOT EXISTS "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- Seed the shipping-charge and flat-GST toggles as enabled by default so
-- existing behaviour (both flat fees applied) is preserved after deploy.
INSERT INTO "app_settings" ("key", "value", "updated_at")
VALUES
    ('shipping_charge_enabled', 'true', CURRENT_TIMESTAMP),
    ('gst_charge_enabled', 'true', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
