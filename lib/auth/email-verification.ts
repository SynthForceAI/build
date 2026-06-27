import type { User as SupabaseUser } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function isEmailConfirmed(authUser: SupabaseUser): boolean {
  return !!authUser.email_confirmed_at;
}

export function emailVerificationRedirectUrl(): string {
  return `${env().NEXT_PUBLIC_APP_URL}/auth/callback`;
}
