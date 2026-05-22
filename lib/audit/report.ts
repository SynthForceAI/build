/**
 * Audit report writer.
 *
 * Takes structured findings + summary stats and asks an LLM to write a
 * plain-business-English report. Provider-agnostic — currently supports
 * OpenAI and Anthropic via their standard chat endpoints. DeepSeek uses
 * the OpenAI-compatible API surface.
 *
 * If AUDIT_AI_API_KEY isn't configured, returns a deterministic
 * template-based report so audits still complete in dev/preview.
 */
import { env } from "../env";
import type { AuditAnalysis } from "./engine";

type ReportInput = {
  companyName: string;
  analysis:    AuditAnalysis;
};

export async function generateReport({ companyName, analysis }: ReportInput): Promise<string> {
  const e = env();
  if (!e.AUDIT_AI_API_KEY) {
    return deterministicFallbackReport(companyName, analysis);
  }
  try {
    if (e.AUDIT_AI_PROVIDER === "anthropic") {
      return await callAnthropic(companyName, analysis, e.AUDIT_AI_MODEL, e.AUDIT_AI_API_KEY);
    }
    // openai-compatible: includes openai + deepseek
    const baseUrl = e.AUDIT_AI_PROVIDER === "deepseek"
      ? "https://api.deepseek.com/v1"
      : "https://api.openai.com/v1";
    return await callOpenAICompatible(companyName, analysis, e.AUDIT_AI_MODEL, e.AUDIT_AI_API_KEY, baseUrl);
  } catch (err) {
    // Don't fail the whole audit if the LLM is down — return fallback.
    // eslint-disable-next-line no-console
    console.warn("[audit] report LLM failed, using fallback:", err);
    return deterministicFallbackReport(companyName, analysis);
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildPrompt(companyName: string, a: AuditAnalysis): string {
  const top = a.findings.slice(0, 5).map((f, i) =>
    `${i + 1}. [${f.severity}] ${f.title}\n   ${f.description}${
      f.potentialSavingsCents != null ? `\n   Potential savings: $${(f.potentialSavingsCents / 100).toFixed(0)}/mo` : ""
    }`,
  ).join("\n\n");

  const models = a.discoveredAgents
    .slice(0, 6)
    .map((m) => `   - ${m.model}: $${(m.totalCostCents / 100).toFixed(2)} (${m.efficiencyRating})`)
    .join("\n");

  return `You are an AI agent auditor for SynthForce. Write a professional audit report in plain business English. No technical jargon. No emojis. No salesy language.

Company: ${companyName}
Total monthly AI spend: $${(a.totalMonthlySpendCents / 100).toFixed(2)}
Efficiency score: ${a.efficiencyScore.toFixed(1)}/100
Estimated monthly waste: $${(a.estimatedWasteCents / 100).toFixed(2)}
Total API calls (in window): ${a.totalApiCalls.toLocaleString()}

Models in use:
${models || "   (none detected)"}

Findings:
${top || "(no findings)"}

Write the report with these sections, in this order, using Markdown headings:

## Executive summary
Two or three sentences. State the headline number and the single biggest opportunity.

## Key findings
Bullet points. Each bullet is one sentence in plain English. Lead with the dollar impact.

## What to do next
Three concrete actions, in priority order. Be specific.

End with one line: "Want to see exactly which agent is causing this? That's what the full SynthForce platform shows you."`;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

async function callOpenAICompatible(
  companyName: string, analysis: AuditAnalysis, model: string, apiKey: string, baseUrl: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You write clear, calm, professional audit reports." },
        { role: "user",   content: buildPrompt(companyName, analysis) },
      ],
      temperature: 0.3,
      max_tokens: 800,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? deterministicFallbackReport(companyName, analysis);
}

async function callAnthropic(
  companyName: string, analysis: AuditAnalysis, model: string, apiKey: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      messages: [{ role: "user", content: buildPrompt(companyName, analysis) }],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const json = await res.json() as { content?: Array<{ text?: string }> };
  return json.content?.[0]?.text?.trim() ?? deterministicFallbackReport(companyName, analysis);
}

// ---------------------------------------------------------------------------
// Fallback (no LLM key set or LLM failed)
// ---------------------------------------------------------------------------

export function deterministicFallbackReport(companyName: string, a: AuditAnalysis): string {
  const lines: string[] = [];
  lines.push(`## Executive summary`);
  lines.push(
    `${companyName} spent $${(a.totalMonthlySpendCents / 100).toFixed(2)} on AI in the audit window. ` +
    `Our analysis flagged about $${(a.estimatedWasteCents / 100).toFixed(2)} in likely waste, ` +
    `giving an efficiency score of ${a.efficiencyScore.toFixed(0)}/100.`,
  );
  lines.push(``);
  lines.push(`## Key findings`);
  if (a.findings.length === 0) {
    lines.push(`- No significant inefficiencies detected in this window. Worth re-running once you have more usage history.`);
  } else {
    for (const f of a.findings.slice(0, 5)) {
      const savings = f.potentialSavingsCents != null
        ? ` (estimated savings: $${(f.potentialSavingsCents / 100).toFixed(0)}/mo)`
        : "";
      lines.push(`- **${f.title}**${savings} — ${f.description}`);
    }
  }
  lines.push(``);
  lines.push(`## What to do next`);
  lines.push(`1. Review which agents or workflows are driving GPT-4 usage and identify candidates to move to GPT-4o-mini.`);
  lines.push(`2. Investigate any flagged cost spikes — they often signal retry storms or runaway loops.`);
  lines.push(`3. Set a monthly budget per agent so the next spike triggers an alert instead of a surprise invoice.`);
  lines.push(``);
  lines.push(`Want to see exactly which agent is causing this? That's what the full SynthForce platform shows you.`);
  return lines.join("\n");
}
