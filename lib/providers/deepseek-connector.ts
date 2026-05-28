export async function verifyDeepseekKey(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.deepseek.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 401) throw new Error("Deepseek rejected the API key (401 Unauthorized)");
  if (res.status === 429) throw new Error("Too many requests. Try again in a few minutes");
  if (!res.ok) throw new Error(`Failed to connect to Deepseek (${res.status})`);
  const data = await res.json() as { data: Array<{ id: string }> };
  return data.data.map((m) => m.id).sort();
}
