/**
 * Auth helpers for Route Handlers and Server Components.
 *
 * `requireUser()` is the workhorse: returns the authenticated user's
 * SynthForce `users` row (with company_id), or throws ApiError(401).
 * The error is intentionally untyped at the call site - route handlers
 * catch and convert via `handleApiError` (see lib/api-errors.ts).
 */
import { prisma } from "./db";
import { createSupabaseServerClient } from "./supabase/server";
import { ApiError } from "./api-errors";
import { isEmailConfirmed } from "./auth/email-verification";
import { OWNER_EMAIL } from "./constants";
import type { User } from "@prisma/client";

export type AuthContext = {
  user: User;
  /** Supabase auth UID (same as user.id, but spelled out for clarity). */
  authId: string;
};

export async function requireUser(): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient();
  const { data: { user: authUser }, error } = await supabase.auth.getUser();

  if (error || !authUser) {
    throw new ApiError(401, "unauthenticated");
  }

  if (!isEmailConfirmed(authUser)) {
    throw new ApiError(403, "email_not_verified", {
      detail: "Verify your email before continuing.",
    });
  }

  // Look up the SynthForce-side user row. If it doesn't exist yet, the
  // signup flow hasn't run - treat as unauthenticated for now. The /api/auth
  // bootstrap route is responsible for creating the users + companies rows.
  const user = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (!user) {
    throw new ApiError(401, "user_record_missing", {
      detail: "Authenticated, but no users row exists. Complete onboarding.",
    });
  }

  return { user, authId: authUser.id };
}

export function requireRole(user: User, ...allowed: User["role"][]): void {
  if (!allowed.includes(user.role)) {
    throw new ApiError(403, "insufficient_role", {
      detail: `Requires one of: ${allowed.join(", ")}.`,
    });
  }
}

// Platform-owner check. The platform owner is the single SynthForce operator
// (identified by OWNER_EMAIL), distinct from a per-company "owner" role. Only
// the platform owner may read cross-tenant data (all users, all activity).
export function isOwner(email?: string): boolean {
  return !!email && email === OWNER_EMAIL;
}

/**
 * Require an authenticated platform owner. Verifies a real Supabase session
 * (via requireUser) and that the user's email matches OWNER_EMAIL. Throws
 * ApiError(403) for any other authenticated user.
 */
export async function requireOwner(): Promise<AuthContext> {
  const ctx = await requireUser();
  if (!isOwner(ctx.user.email)) {
    throw new ApiError(403, "owner_only", { detail: "Platform owner access required." });
  }
  return ctx;
}
