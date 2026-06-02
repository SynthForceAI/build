-- SynthForce — user preferences (email digest + currency)
-- Generated from prisma/schema.prisma. Apply with `prisma migrate deploy`.

-- ============================================================================
-- Enums
-- ============================================================================

CREATE TYPE "email_digest" AS ENUM ('daily', 'weekly', 'never');

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE "user_preferences" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      UUID         NOT NULL,
  "email_digest" "email_digest" NOT NULL DEFAULT 'never',
  "currency"     VARCHAR(8)   NOT NULL DEFAULT 'USD',
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "user_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
