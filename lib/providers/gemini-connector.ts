export async function verifyGeminiKey(apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
  );
  if (res.status === 400 || res.status === 401 || res.status === 403)
    throw new Error("Google rejected the API key");
  if (res.status === 429) throw new Error("Too many requests. Try again in a few minutes");
  if (!res.ok) throw new Error(`Failed to connect to Google Gemini (${res.status})`);
  const data = await res.json() as { models: Array<{ name: string }> };
  return (data.models ?? []).map((m) => m.name).sort();
}
