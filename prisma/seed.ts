/**
 * Seed the database with provider + model reference data.
 *
 * Pricing is in USD per token. Source values are the publicly-listed
 * prices as of the schema's initial commit; review on every
 * provider-price change.
 *
 *     pnpm prisma db seed   (after configuring scripts in package.json)
 *
 * Or directly:
 *
 *     npx tsx prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ModelSeed = {
  modelId: string;
  displayName: string;
  inputPricePerToken: number;
  outputPricePerToken: number;
  contextWindow?: number;
};

type ProviderSeed = {
  name: string;
  displayName: string;
  apiBaseUrl: string;
  models: ModelSeed[];
};

const PROVIDERS: ProviderSeed[] = [
  {
    name: "openai",
    displayName: "OpenAI",
    apiBaseUrl: "https://api.openai.com/v1",
    models: [
      { modelId: "gpt-4o",           displayName: "GPT-4o",           inputPricePerToken: 0.0000025,  outputPricePerToken: 0.00001,   contextWindow: 128000 },
      { modelId: "gpt-4o-mini",      displayName: "GPT-4o mini",      inputPricePerToken: 0.00000015, outputPricePerToken: 0.0000006, contextWindow: 128000 },
      { modelId: "gpt-4-turbo",      displayName: "GPT-4 Turbo",      inputPricePerToken: 0.00001,    outputPricePerToken: 0.00003,   contextWindow: 128000 },
    ],
  },
  {
    name: "anthropic",
    displayName: "Anthropic",
    apiBaseUrl: "https://api.anthropic.com/v1",
    models: [
      { modelId: "claude-3-5-sonnet", displayName: "Claude 3.5 Sonnet", inputPricePerToken: 0.000003,  outputPricePerToken: 0.000015, contextWindow: 200000 },
      { modelId: "claude-3-5-haiku",  displayName: "Claude 3.5 Haiku",  inputPricePerToken: 0.0000008, outputPricePerToken: 0.000004, contextWindow: 200000 },
      { modelId: "claude-3-opus",     displayName: "Claude 3 Opus",     inputPricePerToken: 0.000015,  outputPricePerToken: 0.000075, contextWindow: 200000 },
    ],
  },
  {
    name: "google-gemini",
    displayName: "Google Gemini",
    apiBaseUrl: "https://generativelanguage.googleapis.com/v1",
    models: [
      { modelId: "gemini-1.5-pro",   displayName: "Gemini 1.5 Pro",   inputPricePerToken: 0.00000125, outputPricePerToken: 0.000005,  contextWindow: 2000000 },
      { modelId: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash", inputPricePerToken: 0.000000075, outputPricePerToken: 0.0000003, contextWindow: 1000000 },
    ],
  },
  { name: "cohere",      displayName: "Cohere",      apiBaseUrl: "https://api.cohere.ai/v1",         models: [] },
  { name: "meta-llama",  displayName: "Meta Llama",  apiBaseUrl: "https://api.llama.com/v1",         models: [] },
  { name: "mistral",     displayName: "Mistral AI",  apiBaseUrl: "https://api.mistral.ai/v1",        models: [] },
];

async function main() {
  // ── Providers + models ─────────────────────────
  for (const p of PROVIDERS) {
    const provider = await prisma.provider.upsert({
      where:  { name: p.name },
      update: { displayName: p.displayName, apiBaseUrl: p.apiBaseUrl },
      create: { name: p.name, displayName: p.displayName, apiBaseUrl: p.apiBaseUrl },
    });
    for (const m of p.models) {
      await prisma.providerModel.upsert({
        where:  { providerId_modelId: { providerId: provider.id, modelId: m.modelId } },
        update: {
          displayName:         m.displayName,
          inputPricePerToken:  m.inputPricePerToken,
          outputPricePerToken: m.outputPricePerToken,
          contextWindow:       m.contextWindow ?? 128000,
        },
        create: {
          providerId:          provider.id,
          modelId:             m.modelId,
          displayName:         m.displayName,
          inputPricePerToken:  m.inputPricePerToken,
          outputPricePerToken: m.outputPricePerToken,
          contextWindow:       m.contextWindow ?? 128000,
        },
      });
    }
    console.log(`  ✓ ${p.displayName}  (${p.models.length} models)`);
  }

  // ── Company ────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { slug: "demo-corp" },
    update: {},
    create: {
      name: "Demo Corp",
      slug: "demo-corp",
      subscriptionTier: "team",
    },
  });
  console.log(`  ✓ Company: ${company.name}`);

  // ── Departments ────────────────────────────────
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { companyId_name: { companyId: company.id, name: "Sales" } },
      update: {},
      create: { companyId: company.id, name: "Sales", monthlyBudgetCents: 500000 },
    }),
    prisma.department.upsert({
      where: { companyId_name: { companyId: company.id, name: "Support" } },
      update: {},
      create: { companyId: company.id, name: "Support", monthlyBudgetCents: 300000 },
    }),
    prisma.department.upsert({
      where: { companyId_name: { companyId: company.id, name: "Finance" } },
      update: {},
      create: { companyId: company.id, name: "Finance", monthlyBudgetCents: 200000 },
    }),
  ]);
  console.log(`  ✓ Departments: ${departments.length}`);

  // ── Policies ────────────────────────────────────────────────────────
const [salesDept, supportDept, financeDept] = departments;

await Promise.all([
  prisma.policy.upsert({
    where: { companyId_name: { companyId: company.id, name: "No discounts without approval" } },
    update: {},
    create: {
      companyId: company.id,
      name: "No discounts without approval",
      description: "Agents must never promise discounts greater than 5% without manager approval",
      severity: "block",
      scope: "department",
      scopeDepartmentId: salesDept.id,
      ruleDefinition: { type: "discount_limit", maxPercent: 5 },
    },
  }),
  prisma.policy.upsert({
    where: { companyId_name: { companyId: company.id, name: "No PII access without consent" } },
    update: {},
    create: {
      companyId: company.id,
      name: "No PII access without consent",
      description: "Do not access or share customer personally identifiable information without explicit consent",
      severity: "block",
      scope: "department",
      scopeDepartmentId: supportDept.id,
      ruleDefinition: { type: "pii_access", requireConsent: true },
    },
  }),
    prisma.policy.upsert({
      where: { companyId_name: { companyId: company.id, name: "Invoice approval threshold" } },
      update: {},
      create: {
        companyId: company.id,
        name: "Invoice approval threshold",
        description: "Never approve invoices over $10,000 without a manual audit flag",
        severity: "flag",
        scope: "department",
        scopeDepartmentId: financeDept.id,
        ruleDefinition: { type: "invoice_limit", maxAmountCents: 1000000 },
      },
    }),
    prisma.policy.upsert({
      where: { companyId_name: { companyId: company.id, name: "No future roadmap disclosure" } },
      update: {},
      create: {
        companyId: company.id,
        name: "No future roadmap disclosure",
        description: "Agents must never share unannounced product features or roadmap dates",
        severity: "warning",
        scope: "global",
        ruleDefinition: { type: "content_filter", topic: "roadmap" },
      },
    }),
  ]);
  console.log("  ✓ Policies: 4");

  // Get provider + models for agents
const openai = await prisma.provider.findUnique({ where: { name: "openai" } });
const anthropic = await prisma.provider.findUnique({ where: { name: "anthropic" } });
const gpt4o = await prisma.providerModel.findFirst({
  where: { providerId: openai!.id, modelId: "gpt-4o" }
});
const gpt4oMini = await prisma.providerModel.findFirst({
  where: { providerId: openai!.id, modelId: "gpt-4o-mini" }
});
const claudeHaiku = await prisma.providerModel.findFirst({
  where: { providerId: anthropic!.id, modelId: "claude-3-5-haiku" }
});

const [sales, support, finance] = departments;

const agents = await Promise.all([
  prisma.agent.upsert({
    where: { id: "aaaaaaaa-0001-0001-0001-000000000001" },
    update: {},
    create: {
      id: "aaaaaaaa-0001-0001-0001-000000000001",
      companyId: company.id,
      departmentId: sales.id,
      name: "Lead Qualifier",
      description: "Qualifies inbound leads from website forms",
      status: "active",
      providerId: openai!.id,
      modelId: gpt4o!.id,
      monthlyBudgetCents: 50000n,
      currentMonthSpendCents: 42000n,
    },
  }),
  prisma.agent.upsert({
    where: { id: "aaaaaaaa-0002-0002-0002-000000000002" },
    update: {},
    create: {
      id: "aaaaaaaa-0002-0002-0002-000000000002",
      companyId: company.id,
      departmentId: support.id,
      name: "Support Agent",
      description: "Handles tier-1 customer support tickets",
      status: "paused",
      providerId: anthropic!.id,
      modelId: claudeHaiku!.id,
      monthlyBudgetCents: 30000n,
      currentMonthSpendCents: 28500n,
    },
  }),
  prisma.agent.upsert({
    where: { id: "aaaaaaaa-0003-0003-0003-000000000003" },
    update: {},
    create: {
      id: "aaaaaaaa-0003-0003-0003-000000000003",
      companyId: company.id,
      departmentId: finance.id,
      name: "Invoice Processor",
      description: "Extracts and validates invoice data",
      status: "flagged",
      providerId: openai!.id,
      modelId: gpt4oMini!.id,
      monthlyBudgetCents: 20000n,
      currentMonthSpendCents: 19800n,
    },
  }),
  prisma.agent.upsert({
    where: { id: "aaaaaaaa-0004-0004-0004-000000000004" },
    update: {},
    create: {
      id: "aaaaaaaa-0004-0004-0004-000000000004",
      companyId: company.id,
      departmentId: sales.id,
      name: "Sales Representative",
      description: "Handles outbound sales outreach",
      status: "active",
      providerId: openai!.id,
      modelId: gpt4o!.id,
      monthlyBudgetCents: 40000n,
      currentMonthSpendCents: 12000n,
    },
  }),
]);
console.log(`  ✓ Agents: ${agents.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
