export async function verifyOpenAiKey(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 401) throw new Error("OpenAI rejected the API key (401 Unauthorized)");
  if (res.status === 429) throw new Error("Too many requests. Try again in a few minutes");
  if (!res.ok) throw new Error(`Failed to connect to OpenAI (${res.status})`);
  const data = await res.json() as { data: Array<{ id: string }> };
  return data.data.map((m) => m.id).sort();
}

// Admin keys (sk-admin-…) are scoped to the Organization API and return 403
// on /v1/models. Verify them against the usage endpoint instead.
export async function verifyOpenAiAdminKey(apiKey: string): Promise<string[]> {
  const url = new URL("https://api.openai.com/v1/organization/usage/completions");
  url.searchParams.set("start_time", String(Math.floor(Date.now() / 1000) - 3600));
  url.searchParams.set("limit", "1");
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${apiKey}` } });
  if (res.status === 401) throw new Error("OpenAI rejected the admin key (401). Use an sk-admin- key with usage read access.");
  if (res.status === 403) throw new Error("This key lacks org usage access (403). Create an Admin key at Settings → Organization → Admin keys.");
  if (res.status === 429) throw new Error("Too many requests. Try again in a few minutes.");
  if (!res.ok) throw new Error(`Failed to verify admin key with OpenAI (${res.status}).`);
  return [];
}
