-- Add is_platform_owner flag to users.
-- Default false. Only set true via the owner dashboard.
-- The primary owner (samarth@synthforceai.com) is always treated as owner
-- regardless of this flag, but their row will also have this set to true
-- for consistency (handled by the grant API on first use).

ALTER TABLE "users" ADD COLUMN "is_platform_owner" BOOLEAN NOT NULL DEFAULT false;
