/**
 * Demo audit data returned when the key "sk-admin-demo" (or "sk-admin-1234")
 * is submitted on the free audit form.
 *
 * Scenario summary:
 *   • $10,239.34 total spend — numbers look real, not rounded
 *   • 61% of spend on legacy GPT-4 → HIGH model-optimization finding
 *   • Spend up 70% in the second half of the period → HIGH trend finding
 *   • 2 cost spikes on individual days → cost_spike finding
 *   • Last-7-day avg ≈ $511/day → 30-day projection $15,341 → exceeds a
 *     $15,000 budget, so BurnRateCard turns orange
 *   • chatbot-production project is an outlier (63.6% of spend, +127% MoM)
 *   • All traffic is realtime (no batch) → batch opportunity card lights up
 *   • 2 unused API keys detected → right-tool concern
 */
import type { ProviderUsageReport } from "../providers/openai-billing";

const DEMO_KEYS = new Set(["sk-admin-demo", "sk-admin-1234"]);

export function isDemoKey(apiKey: string): boolean {
  return DEMO_KEYS.has(apiKey.trim());
}

// ---------------------------------------------------------------------------
// Daily spend pattern — 30 values, sum = 1,023,934 cents ($10,239.34)
// ---------------------------------------------------------------------------
// Structure:
//   Days  1-15  (first half)  = 378,999 c  — moderate, slowly rising
//   Days 16-23  (mid period)  = 286,963 c  — noticeably climbing
//   Days 24-30  (last 7)      = 357,972 c  — avg $511/day (over $15k budget);
//                                             includes two 2×-avg spikes
const DAILY_CENTS = [
   22_817,  24_103,  21_456,  23_891,  25_234,  22_678,  24_512,  // days  1-7
   26_789,  25_134,  27_456,  24_891,  26_234,  28_123,  27_567,  // days  8-14
   28_114,                                                          // day  15
   31_234,  33_567,  35_123,  37_456,  34_891,  36_234,  38_567,  // days 16-22
   39_891,                                                          // day  23
   42_134,  44_891,  81_234,  46_789,  83_671,  45_112,  14_141,  // days 24-30 (26 & 28 are spikes)
];
// Verify: 378999 + 286963 + 357972 = 1,023,934

// ---------------------------------------------------------------------------
// Per-model totals — sum = 1,023,934 cents
// ---------------------------------------------------------------------------
const BY_MODEL = [
  {
    model:          "gpt-4",
    costCents:      620_000,  // 60.5% → triggers HIGH model_optimization
    calls:           12_456,
    tokensIn:    52_938_000,  // avg 4,250 input tokens/call
    tokensOut:    2_017_872,  // avg 162 output tokens/call → HIGH confidence mismatch
    tokensInCached:       0,
  },
  {
    model:          "gpt-4o",
    costCents:      249_153,  // 24.3%
    calls:           31_892,
    tokensIn:    76_540_800,  // avg 2,400 input tokens/call
    tokensOut:    4_560_556,  // avg 143 output tokens/call → mismatch candidate
    tokensInCached: 12_340_000,
  },
  {
    model:          "gpt-4o-mini",
    costCents:      115_064,  // 11.2%
    calls:           98_234,
    tokensIn:    45_187_640,
    tokensOut:   14_047_462,
    tokensInCached: 8_900_000,
  },
  {
    model:          "o1-preview",
    costCents:       39_717,  // 3.9% — triggers reasoning efficiency section
    calls:            1_234,
    tokensIn:     3_455_200,
    tokensOut:    1_837_426,  // avg 1,489 output tokens → ≥500, no mismatch flag
    tokensInCached:       0,
  },
];

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildDemoReport(periodDays: number): ProviderUsageReport {
  const now   = new Date();
  const start = new Date(now.getTime() - periodDays * 86_400_000);

  // Generate dates for each day in the period (oldest first).
  // If periodDays > 30 we pad the earlier days with zeros so the last 30
  // always match DAILY_CENTS; if < 30 we use the tail of DAILY_CENTS.
  const dailySpendCents: ProviderUsageReport["dailySpendCents"] = [];
  for (let i = 0; i < periodDays; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const patternIdx = i - (periodDays - DAILY_CENTS.length);
    dailySpendCents.push({
      date:      d.toISOString().slice(0, 10),
      costCents: patternIdx >= 0 ? DAILY_CENTS[patternIdx] : 0,
      calls:     0,
    });
  }

  const totalTokensIn  = BY_MODEL.reduce((s, m) => s + m.tokensIn, 0);
  const totalTokensOut = BY_MODEL.reduce((s, m) => s + m.tokensOut, 0);
  const totalCalls     = BY_MODEL.reduce((s, m) => s + m.calls, 0);

  return {
    provider:       "openai",
    periodStart:    start,
    periodEnd:      now,
    totalCostCents: 1_023_934,
    totalCalls,
    totalTokensIn,
    totalTokensOut,
    dailySpendCents,
    byModel:        BY_MODEL,
    rawResponses:   [{ source: "demo", body: {} }],

    // 3 projects — chatbot-production is a spend outlier (+127% MoM)
    projectSpend: [
      { projectId: "chatbot-production",  costCents: 651_423, prevCostCents: 287_234, calls: 34_234 },
      { projectId: "data-pipeline",       costCents: 267_891, prevCostCents: 253_112, calls: 18_789 },
      { projectId: "dev-testing",         costCents: 104_620, prevCostCents:  95_234, calls:  8_671 },
    ],

    // All traffic is realtime — batch opportunity card shows savings potential
    batchVsRealtime: [
      { isBatch: false, costCents: 1_023_934, calls: totalCalls },
    ],

    // 2 unused keys — unused key concern shows up in the right-tool section
    apiKeyActivity: [
      { apiKeyId: "key_prod_primary",  calls: totalCalls, costCents: 1_023_934 },
      { apiKeyId: "key_staging_01",    calls: 0,          costCents: 0 },
      { apiKeyId: "key_backup_legacy", calls: 0,          costCents: 0 },
    ],
  };
}
