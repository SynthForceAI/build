/**
 * Typed, validated environment access.
 *
 * Every server-side module that needs an env var imports from here.
 * Failure to validate at import time crashes the function immediately,
 * which is better than silently misbehaving in a route handler later.
 */
import { z } from "zod";

const ServerEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL:   z.string().url().optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL:      z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY:     z.string().min(20),

  // Crypto — 32 bytes (256 bits), base64-encoded → 44 chars including padding.
  // Generate with: `openssl rand -base64 32`
  API_KEY_ENCRYPTION_KEY: z.string().regex(
    /^[A-Za-z0-9+/]{43}=$/,
    "API_KEY_ENCRYPTION_KEY must be exactly 32 bytes, base64-encoded (44 chars incl. padding)",
  ),

  // Audit report LLM — SynthForce's own key for generating audit reports.
  // Separate from customer-provided API keys. Cheap models recommended
  // (gpt-4o-mini, deepseek-chat) — see lib/audit/report.ts.
  AUDIT_AI_PROVIDER: z.enum(["openai", "anthropic", "deepseek"]).default("openai"),
  AUDIT_AI_MODEL:    z.string().default("gpt-4o-mini"),
  AUDIT_AI_API_KEY:  z.string().min(10).optional(), // Optional; audit run fails gracefully without it.

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV:            z.enum(["development", "test", "production"]).default("development"),

  // Shared secret for the provider-usage cron endpoint. Vercel Cron injects it
  // as a Bearer token when set; the job route fails closed if it is absent.
  CRON_SECRET: z.string().min(16).optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid server environment. See logs above.");
  }
  cached = parsed.data;
  return cached;
}
