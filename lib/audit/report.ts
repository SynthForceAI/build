/**
 * Audit report writer.
 *
 * Takes structured findings + summary stats and asks an LLM to write a
 * plain-business-English report. Provider-agnostic - currently supports
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
    // Don't fail the whole audit if the LLM is down - return fallback.
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
      f.potentialSavingsCents != null ? `\n   Potential savings: $${(f.potentialSavingsCents / 100).toFixed(2)}/mo` : ""
    }`,
  ).join("\n\n");

  const models = a.discoveredAgents
    .slice(0, 6)
    .map((m) => `   - ${m.model}: $${(m.totalCostCents / 100).toFixed(2)} (${m.efficiencyRating})`)
    .join("\n");

  return `You are an AI cost auditor for SynthForce. Write a short, clear audit report in plain conversational English.

Rules:
- Plain text only. No markdown. No hashtags (#). No asterisks. No backticks.
- No em-dashes (—). Use a plain comma or rewrite the sentence instead.
- No emojis. No technical jargon. No salesy language.
- Use exact dollar figures from the data. Never say "$0" if the actual value is non-zero.

Data:
Company: ${companyName}
Total AI spend (30-day window): $${(a.totalMonthlySpendCents / 100).toFixed(2)}
Efficiency score: ${a.efficiencyScore.toFixed(1)}/100
Estimated monthly waste: $${(a.estimatedWasteCents / 100).toFixed(2)}
Total API calls: ${a.totalApiCalls.toLocaleString()}

Models in use:
${models || "   (none detected)"}

Findings:
${top || "(no findings)"}

Write the report in exactly this structure, using these plain-text section labels:

Executive Summary
Two or three sentences. State the headline spend, efficiency score, and single biggest opportunity.

Key Findings
One plain sentence per finding, starting with a hyphen. Lead with the dollar figure.

What to Do Next
Three numbered, specific actions in priority order.

End with exactly this line: "Want to see exactly which agent is causing this? That is what the full SynthForce platform shows you."`;
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
  lines.push(`Executive Summary`);
  lines.push(
    `${companyName} spent $${(a.totalMonthlySpendCents / 100).toFixed(2)} on AI in the audit window. ` +
    `Our analysis flagged about $${(a.estimatedWasteCents / 100).toFixed(2)} in likely waste, ` +
    `giving an efficiency score of ${a.efficiencyScore.toFixed(0)}/100.`,
  );
  lines.push(``);
  lines.push(`Key Findings`);
  if (a.findings.length === 0) {
    lines.push(`- No significant inefficiencies detected in this window. Worth re-running once you have more usage history.`);
  } else {
    for (const f of a.findings.slice(0, 5)) {
      const savings = f.potentialSavingsCents != null
        ? ` (estimated savings: $${(f.potentialSavingsCents / 100).toFixed(2)}/mo)`
        : "";
      lines.push(`- ${f.title}${savings}: ${f.description}`);
    }
  }
  lines.push(``);
  lines.push(`What to Do Next`);
  lines.push(`1. Review which agents or workflows are driving GPT-4 usage and identify candidates to move to GPT-4o-mini.`);
  lines.push(`2. Investigate any flagged cost spikes. They often signal retry storms or runaway loops.`);
  lines.push(`3. Set a monthly budget per agent so the next spike triggers an alert instead of a surprise invoice.`);
  lines.push(``);
  lines.push(`Want to see exactly which agent is causing this? That is what the full SynthForce platform shows you.`);
  return lines.join("\n");
}
