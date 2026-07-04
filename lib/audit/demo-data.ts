/**
 * Demo audit data returned for known demo keys.
 *
 * OpenAI demo  → sk-admin-demo  | sk-admin-1234
 * Anthropic demo → sk-ant-admin-demo | sk-ant-admin-1234
 *
 * These keys bypass real provider API calls and return a pre-built
 * ProviderUsageReport designed to light up every product signal.
 */
import type { ProviderUsageReport } from "../providers/openai-billing";

const DEMO_KEYS = new Set([
  "sk-admin-demo",
  "sk-admin-1234",
  "sk-ant-admin-demo",
  "sk-ant-admin-1234",
]);

export function isDemoKey(apiKey: string): boolean {
  return DEMO_KEYS.has(apiKey.trim());
}

export function isAnthropicDemoKey(apiKey: string): boolean {
  const k = apiKey.trim();
  return k === "sk-ant-admin-demo" || k === "sk-ant-admin-1234";
}

// ===========================================================================
// OpenAI demo
// ===========================================================================
//
// Scenario:
//   • $10,239.34 total — non-round, reads as real
//   • 61% legacy GPT-4 → HIGH model_optimization + single mismatch flag
//     (gpt-4o outputs are set to 642 avg tokens → above the 500-token
//      threshold, so it is NOT flagged — only legacy gpt-4 gets the flag)
//   • +70% spend second half vs first → HIGH spend_trend finding
//   • 2 cost spikes → cost_spike finding
//   • Last-7-day avg $511/day → 30-day projection $15,342, exceeds a
//     $15k budget so BurnRateCard turns orange
//   • chatbot-production: 63.6% of project spend, +127% MoM → outlier
//   • All realtime traffic → batch opportunity card lights up
//   • 2 unused API keys → unused keys section shows concern

// Daily pattern — 30 values, sum = 1,023,934 cents ($10,239.34)
const OAI_DAILY_CENTS = [
   22_817,  24_103,  21_456,  23_891,  25_234,  22_678,  24_512,  // days  1-7
   26_789,  25_134,  27_456,  24_891,  26_234,  28_123,  27_567,  // days  8-14
   28_114,                                                          // day  15
   31_234,  33_567,  35_123,  37_456,  34_891,  36_234,  38_567,  // days 16-22
   39_891,                                                          // day  23
   42_134,  44_891,  81_234,  46_789,  83_671,  45_112,  14_141,  // days 24-30 (26 & 28 are spikes)
];
// Totals: first 15 = 378,999 | days 16-23 = 286,963 | last 7 = 357,972 | grand = 1,023,934

const OAI_BY_MODEL = [
  {
    model:          "gpt-4",
    costCents:      620_000,   // 60.5% → triggers HIGH model_optimization
    calls:           12_456,
    tokensIn:    52_938_000,   // avg 4,250 input tokens/call
    tokensOut:    2_017_872,   // avg 162 output tokens/call → HIGH confidence mismatch
    tokensInCached:       0,
  },
  {
    model:          "gpt-4o",
    costCents:      249_153,   // 24.3%
    calls:           31_892,
    tokensIn:    76_540_800,   // avg 2,400 input
    tokensOut:   20_474_664,   // avg 642 output tokens — above 500, so NOT flagged as mismatch
    tokensInCached: 12_340_000,
  },
  {
    model:          "gpt-4o-mini",
    costCents:      115_064,   // 11.2%
    calls:           98_234,
    tokensIn:    45_187_640,
    tokensOut:   14_047_462,
    tokensInCached: 8_900_000,
  },
  {
    model:          "o1-preview",
    costCents:       39_717,   // 3.9% — triggers reasoning efficiency section
    calls:            1_234,
    tokensIn:     3_455_200,
    tokensOut:    1_837_426,   // avg 1,489 output tokens → above 500, no mismatch flag
    tokensInCached:       0,
  },
];

export function buildDemoReport(periodDays: number): ProviderUsageReport {
  const now   = new Date();
  const start = new Date(now.getTime() - periodDays * 86_400_000);

  const dailySpendCents: ProviderUsageReport["dailySpendCents"] = [];
  for (let i = 0; i < periodDays; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const patternIdx = i - (periodDays - OAI_DAILY_CENTS.length);
    dailySpendCents.push({
      date:      d.toISOString().slice(0, 10),
      costCents: patternIdx >= 0 ? OAI_DAILY_CENTS[patternIdx] : 0,
      calls:     0,
    });
  }

  const totalTokensIn  = OAI_BY_MODEL.reduce((s, m) => s + m.tokensIn, 0);
  const totalTokensOut = OAI_BY_MODEL.reduce((s, m) => s + m.tokensOut, 0);
  const totalCalls     = OAI_BY_MODEL.reduce((s, m) => s + m.calls, 0);

  return {
    provider:       "openai",
    periodStart:    start,
    periodEnd:      now,
    totalCostCents: 1_023_934,
    totalCalls,
    totalTokensIn,
    totalTokensOut,
    dailySpendCents,
    byModel:        OAI_BY_MODEL,
    rawResponses:   [{ source: "demo", body: {} }],

    projectSpend: [
      { projectId: "chatbot-production",  costCents: 651_423, prevCostCents: 287_234, calls: 34_234 },
      { projectId: "data-pipeline",       costCents: 267_891, prevCostCents: 253_112, calls: 18_789 },
      { projectId: "dev-testing",         costCents: 104_620, prevCostCents:  95_234, calls:  8_671 },
    ],

    // All realtime → batch opportunity card shows savings
    batchVsRealtime: [
      { isBatch: false, costCents: 1_023_934, calls: totalCalls },
    ],

    // 2 unused keys → unused-keys concern section
    apiKeyActivity: [
      { apiKeyId: "key_prod_primary",  calls: totalCalls, costCents: 1_023_934 },
      { apiKeyId: "key_staging_01",    calls: 0,          costCents: 0 },
      { apiKeyId: "key_backup_legacy", calls: 0,          costCents: 0 },
    ],
  };
}

// ===========================================================================
// Anthropic demo
// ===========================================================================
//
// Scenario:
//   • $8,743.19 total — different number from OpenAI demo
//   • claude-3-opus: 52% of spend, avg 187 output tokens → mismatch → claude-3-haiku
//   • claude-3-5-sonnet: 30%, avg 156 output tokens → mismatch → claude-haiku-3-5
//   • Cache hit rate 8% vs 70% benchmark → cache efficiency CONCERN
//     (~$160/mo potential savings shown)
//   • +78% spend second half vs first → HIGH spend_trend finding
//   • 2 cost spikes → cost_spike finding
//   • Last-7-day avg $446/day → 30-day projection $13,387, exceeds a
//     $10k budget so BurnRateCard turns orange
//   • No project spend / batch / unused keys (Anthropic doesn't expose these)

// Daily pattern — 30 values, sum = 874,319 cents ($8,743.19)
const ANT_DAILY_CENTS = [
   18_234,  19_872,  17_643,  20_156,  19_234,  18_891,  20_512,  // days  1-7
   21_789,  22_134,  23_456,  21_891,  22_673,  24_123,  23_567,  // days  8-14
   20_825,                                                          // day  15
   26_234,  28_567,  30_123,  31_456,  29_891,  32_234,  33_567,  // days 16-22
   34_891,                                                          // day  23
   38_234,  39_891,  68_923,  41_789,  71_234,  40_890,  11_395,  // days 24-30 (26 & 28 are spikes)
];
// Totals: first 15 = 315,000 | days 16-23 = 246,963 | last 7 = 312,356 | grand = 874,319

const ANT_BY_MODEL = [
  {
    model:            "claude-3-opus-20240229",
    costCents:         454_626,   // 52% → flagged: avg 187 output tokens, HIGH confidence mismatch
    calls:              10_876,
    tokensIn:       45_679_200,   // avg 4,200 input tokens/call
    tokensOut:       2_033_812,   // avg 187 output tokens/call
    tokensInCached:  3_654_336,   // 8% cache hit rate
  },
  {
    model:            "claude-3-5-sonnet-20241022",
    costCents:         262_296,   // 30% → flagged: avg 156 output tokens, HIGH confidence mismatch
    calls:              18_693,
    tokensIn:       52_340_400,   // avg 2,800 input tokens/call
    tokensOut:       2_916_108,   // avg 156 output tokens/call
    tokensInCached:  4_187_232,   // 8% cache hit rate
  },
  {
    model:            "claude-3-haiku-20240307",
    costCents:         157_397,   // 18% — cheap model, no mismatch flag
    calls:              49_845,
    tokensIn:       28_910_100,   // avg 580 input tokens/call
    tokensOut:       3_481_965,   // avg 70 output tokens/call
    tokensInCached:  2_312_808,   // 8% cache hit rate
  },
];

export function buildAnthropicDemoReport(periodDays: number): ProviderUsageReport {
  const now   = new Date();
  const start = new Date(now.getTime() - periodDays * 86_400_000);

  const dailySpendCents: ProviderUsageReport["dailySpendCents"] = [];
  for (let i = 0; i < periodDays; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const patternIdx = i - (periodDays - ANT_DAILY_CENTS.length);
    dailySpendCents.push({
      date:      d.toISOString().slice(0, 10),
      costCents: patternIdx >= 0 ? ANT_DAILY_CENTS[patternIdx] : 0,
      calls:     0,
    });
  }

  const totalTokensIn  = ANT_BY_MODEL.reduce((s, m) => s + m.tokensIn, 0);
  const totalTokensOut = ANT_BY_MODEL.reduce((s, m) => s + m.tokensOut, 0);

  return {
    provider:       "anthropic",
    periodStart:    start,
    periodEnd:      now,
    totalCostCents: 874_319,
    totalCalls:     0,   // Anthropic usage API doesn't return request counts
    totalTokensIn,
    totalTokensOut,
    dailySpendCents,
    byModel:        ANT_BY_MODEL,
    rawResponses:   [{ source: "demo", body: {} }],
    // projectSpend, batchVsRealtime, apiKeyActivity intentionally absent:
    // Anthropic's API doesn't expose these, so the telemetry sections
    // show "data unavailable" exactly as they would for a real Anthropic key.
  };
}
