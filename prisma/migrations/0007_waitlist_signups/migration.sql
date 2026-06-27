-- SynthForce — internal marketing waitlist signups
-- Generated from prisma/schema.prisma. Apply with `prisma migrate deploy`.

CREATE TABLE "waitlist_signups" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "email"      VARCHAR(255) NOT NULL,
  "name"       VARCHAR(255),
  "company"    VARCHAR(255),
  "role"       VARCHAR(255),
  "source"     VARCHAR(255),
  "metadata"   JSONB        NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT "waitlist_signups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "waitlist_signups_email_key" UNIQUE ("email")
);

CREATE INDEX "waitlist_signups_created_at_idx" ON "waitlist_signups" ("created_at" DESC);
