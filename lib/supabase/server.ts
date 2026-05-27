/**
 * Server-side Supabase client (per-request, reads/writes auth cookies).
 *
 * Use inside Route Handlers, Server Components, and Server Actions.
 * Do NOT cache the returned client — it captures the current request's
 * cookie store.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "../env";

type CookiesToSet = { name: string; value: string; options?: CookieOptions }[];

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const e = env();
  return createServerClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — cookies are read-only there.
          // Middleware handles the refresh path; safe to ignore.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS — use ONLY in trusted server code
 * (background jobs, admin endpoints, the proxy logging path).
 *
 * Never expose this client to user-facing handlers; route them through
 * `createSupabaseServerClient` so RLS + auth.uid() apply.
 */
import { createClient } from "@supabase/supabase-js";

let serviceClient: ReturnType<typeof createClient> | undefined;

export function createSupabaseServiceClient() {
  if (serviceClient) return serviceClient;
  const e = env();
  serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

