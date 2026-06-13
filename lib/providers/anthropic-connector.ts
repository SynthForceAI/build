export async function verifyAnthropicKey(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (res.status === 401) throw new Error("Anthropic rejected the API key (401 Unauthorized)");
  if (res.status === 429) throw new Error("Too many requests. Try again in a few minutes");
  if (!res.ok) throw new Error(`Failed to connect to Anthropic (${res.status})`);
  const data = await res.json() as { data: Array<{ id: string }> };
  return data.data.map((m) => m.id).sort();
}

// Admin keys (sk-ant-admin-…) are scoped to the Organization API and return 403
// on /v1/models. Verify them against the usage endpoint instead.
export async function verifyAnthropicAdminKey(apiKey: string): Promise<string[]> {
  const url = new URL("https://api.anthropic.com/v1/organizations/usage_report/messages");
  url.searchParams.set("starting_at", new Date(Date.now() - 3_600_000).toISOString());
  url.searchParams.set("ending_at", new Date().toISOString());
  url.searchParams.set("limit", "1");
  const res = await fetch(url.toString(), {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (res.status === 401) throw new Error("Anthropic rejected the admin key (401). Use an sk-ant-admin- key.");
  if (res.status === 403) throw new Error("This key lacks org access (403). Create an Admin key in the Anthropic Console.");
  if (res.status === 429) throw new Error("Too many requests. Try again in a few minutes.");
  if (!res.ok) throw new Error(`Failed to verify admin key with Anthropic (${res.status}).`);
  return [];
}

export async function resolveAnthropicKeyId(
  adminKey: string,
  fingerprint: string,
): Promise<string | null> {
  const url = new URL("https://api.anthropic.com/v1/organizations/api_keys");
  url.searchParams.set("status", "active");
  url.searchParams.set("limit", "1000");
  const res = await fetch(url.toString(), {
    headers: {
      "x-api-key": adminKey,
      "anthropic-version": "2023-06-01",
    },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json() as { data: Array<{ id: string; partial_key_hint: string }> };
  return data.data.find((k) => k.partial_key_hint.endsWith(fingerprint))?.id ?? null;
}
