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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
