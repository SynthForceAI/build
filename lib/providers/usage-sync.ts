/**
 * Shared plumbing for provider usage polling.
 *
 * Each provider module fetches + normalizes its usage into NormalizedBucket[]
 * and hands them to `persistBuckets`, which attributes each bucket to a
 * ConnectedAgent, dedupes against prior polls, writes usage logs, and bumps
 * the agent's counters/status.
 *
 * Attribution limitation: provider billing/usage APIs aggregate by org /
 * project / api-key, not by our notion of an "agent". When several connected
 * agents share one provider and a bucket can't be matched by an identifier in
 * ConnectedAgent.metadata, we attribute to the first connected agent for that
 * provider. This mirrors the DiscoveredAgent caveat in the audit engine.
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { calculateCostCents } from "./pricing";

export type SyncResult = {
  success: boolean;
  provider: string;
  logsCreated: number;
  agentsActivated: number;
  note?: string;
};

export type NormalizedBucket = {
  /** Stable provider-side id for this record; used to dedupe repeated polls. */
  providerApiId: string;
  tokensIn: number;
  tokensOut: number;
  /** Provider-reported cost in cents; 0/undefined means "estimate from tokens". */
  costCents?: number;
  model?: string | null;
  /** project_id / api_key_id etc., matched against ConnectedAgent.metadata. */
  attributionKey?: string | null;
  metadata?: Record<string, unknown>;
};

type Agent = Awaited<ReturnType<typeof loadAgents>>[number];

function loadAgents(companyId: string, providerId: string) {
  return prisma.connectedAgent.findMany({
    where: { companyId, providerId, deletedAt: null },
    orderBy: { connectedAt: "asc" },
  });
}

function pickAgent(agents: Agent[], attributionKey: string | null | undefined): Agent | null {
  if (agents.length === 0) return null;
  if (attributionKey) {
    const match = agents.find((a) => {
      const meta = (a.metadata ?? {}) as Record<string, unknown>;
      return Object.values(meta).some((v) => v === attributionKey);
    });
    if (match) return match;
  }
  // Single agent, or no identifier match: attribute to the earliest-connected.
  return agents[0];
}

export async function persistBuckets(
  companyId: string,
  providerId: string,
  providerName: string,
  buckets: NormalizedBucket[],
): Promise<SyncResult> {
  const agents = await loadAgents(companyId, providerId);
  if (agents.length === 0) {
    return { success: true, provider: providerName, logsCreated: 0, agentsActivated: 0, note: "no connected agents for this provider" };
  }

  type Tally = { tokensIn: number; tokensOut: number; costCents: number; created: number };
  const tallies = new Map<string, Tally>();

  let logsCreated = 0;

  for (const b of buckets) {
    const target = pickAgent(agents, b.attributionKey);
    if (!target) continue;

    const costCents =
      b.costCents && b.costCents > 0
        ? b.costCents
        : calculateCostCents(providerName, b.model ?? null, b.tokensIn, b.tokensOut);

    try {
      await prisma.connectedAgentUsageLog.create({
        data: {
          companyId,
          connectedAgentId: target.id,
          providerId,
          source:           "provider_sync",
          tokensIn:         b.tokensIn,
          tokensOut:        b.tokensOut,
          costCents,
          model:            b.model ?? null,
          providerApiId:    b.providerApiId,
          metadata:         (b.metadata ?? {}) as object,
        },
      });
    } catch (err) {
      // Already ingested in a prior poll — skip without double-counting.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }

    logsCreated++;
    const t = tallies.get(target.id) ?? { tokensIn: 0, tokensOut: 0, costCents: 0, created: 0 };
    t.tokensIn += b.tokensIn;
    t.tokensOut += b.tokensOut;
    t.costCents += costCents;
    t.created += 1;
    tallies.set(target.id, t);
  }

  let agentsActivated = 0;
  const now = new Date();

  for (const [agentId, t] of tallies) {
    const agent = agents.find((a) => a.id === agentId)!;
    const wasPending = agent.status === "pending";
    const costInt = BigInt(Math.round(t.costCents));

    await prisma.connectedAgent.update({
      where: { id: agentId },
      data: {
        status:            wasPending ? "active" : agent.status,
        tasksMonitored:    { increment: t.created },
        totalTokensIn:     { increment: BigInt(t.tokensIn) },
        totalTokensOut:    { increment: BigInt(t.tokensOut) },
        totalCostCents:    { increment: costInt },
        monthlySpendCents: { increment: costInt },
        lastSyncedAt:      now,
        lastActiveAt:      now,
      },
    });
    if (wasPending) agentsActivated++;
  }

  return { success: true, provider: providerName, logsCreated, agentsActivated };
}
