-- Restore migration file for reel type/category support.
-- This migration is written to be idempotent across environments.

DO $$
BEGIN
  IF to_regclass('public.reels') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'ReelCategory' AND n.nspname = 'public'
    ) THEN
      CREATE TYPE "ReelCategory" AS ENUM ('MENS', 'KIDS');
    END IF;

    ALTER TABLE "reels"
      ADD COLUMN IF NOT EXISTS "category" "ReelCategory" NOT NULL DEFAULT 'MENS';
  END IF;
END $$;
