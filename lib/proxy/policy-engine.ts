import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import type { Policy, PolicySeverity } from "@prisma/client";

export type PolicyCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string; statusCode: number };

type RuleDefinition = { type: string; value: unknown }[];

export async function checkAgentPolicy(
  agentId: string,
  model: string | null,
  method: string,
  parsedBody: unknown,
): Promise<PolicyCheckResult> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      policyAssignments: {
        include: { policy: true },
      },
    },
  });

  if (!agent) {
    return { allowed: false, reason: "Agent not found.", statusCode: 404 };
  }

  // Agent-level kill-switch - status set directly on the agent row
  if (agent.status !== "active") {
    return {
      allowed: false,
      reason: `Agent is ${agent.status}. All requests are blocked.`,
      statusCode: 403,
    };
  }

  // Evaluate each assigned policy in order
  for (const { policy } of agent.policyAssignments) {
    if (!policy.isActive) continue;

    const result = await evaluatePolicy(policy, agentId, model, method, parsedBody);
    if (!result.allowed) return result;
  }

  return { allowed: true };
}

async function evaluatePolicy(
  policy: Policy,
  agentId: string,
  model: string | null,
  method: string,
  parsedBody: unknown,
): Promise<PolicyCheckResult> {
  // Only "block" severity stops the request; others are observational
  if (policy.severity !== ("block" as PolicySeverity)) {
    return { allowed: true };
  }

  const rules = policy.ruleDefinition as RuleDefinition;
  if (!Array.isArray(rules)) return { allowed: true };

  for (const rule of rules) {
    const result = await evaluateRule(rule, agentId, model, parsedBody);
    if (!result.allowed) return result;
  }

  return { allowed: true };
}

async function evaluateRule(
  rule: { type: string; value: unknown },
  agentId: string,
  model: string | null,
  parsedBody: unknown,
): Promise<PolicyCheckResult> {
  switch (rule.type) {
    case "KILL_SWITCH": {
      if (rule.value === false) {
        return { allowed: false, reason: "Agent is disabled by policy.", statusCode: 403 };
      }
      return { allowed: true };
    }

    case "MODEL_WHITELIST": {
      if (!model) return { allowed: true }; // no model in request - not a completion call
      const allowed = rule.value as string[];
      if (!allowed.includes(model)) {
        return {
          allowed: false,
          reason: `Model "${model}" is not permitted. Allowed: ${allowed.join(", ")}.`,
          statusCode: 403,
        };
      }
      return { allowed: true };
    }

    case "MODEL_BLACKLIST": {
      if (!model) return { allowed: true };
      const blocked = rule.value as string[];
      if (blocked.includes(model)) {
        return {
          allowed: false,
          reason: `Model "${model}" is blocked by policy.`,
          statusCode: 403,
        };
      }
      return { allowed: true };
    }

    case "SPEND_CAP_MONTHLY":
      return checkMonthlySpend(agentId, rule.value as number);

    case "RATE_LIMIT":
      return Promise.resolve(
        checkRateLimit(agentId, (rule.value as { requestsPerMinute: number }).requestsPerMinute),
      );

    case "DATA_ACCESS":
      return checkDataAccessPatterns(parsedBody, rule.value as string[]);

    default:
      return { allowed: true };
  }
}

async function checkMonthlySpend(
  agentId: string,
  spendCapCents: number,
): Promise<PolicyCheckResult> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const agg = await prisma.usageLog.aggregate({
    where: { agentId, createdAt: { gte: monthStart } },
    _sum: { costCents: true },
  });

  // costCents is Decimal - convert to number for comparison
  const totalCents = Number(agg._sum.costCents ?? 0);

  if (totalCents >= spendCapCents) {
    return {
      allowed: false,
      reason: `Monthly spend cap exceeded: $${(totalCents / 100).toFixed(2)} of $${(spendCapCents / 100).toFixed(2)} limit.`,
      statusCode: 403,
    };
  }

  return { allowed: true };
}

/**
 * Per-agent request rate limit.
 *
 * Counts synchronously in-memory at policy-check time (which runs *before* the
 * upstream call), so it holds under concurrent bursts. The previous approach
 * counted rows in `usageLog`, which is written fire-and-forget *after* the
 * response — a burst of concurrent requests all saw a stale count and slipped
 * through. See lib/rate-limit.ts for the per-instance caveat.
 */
function checkRateLimit(
  agentId: string,
  requestsPerMinute: number,
): PolicyCheckResult {
  if (typeof requestsPerMinute !== "number" || requestsPerMinute <= 0) {
    return { allowed: true }; // misconfigured rule - fail open rather than block everything
  }

  const { ok } = rateLimit(`agent-rpm:${agentId}`, requestsPerMinute, 60_000);
  if (!ok) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: limit is ${requestsPerMinute} requests/minute.`,
      statusCode: 429,
    };
  }

  return { allowed: true };
}

function checkDataAccessPatterns(
  parsedBody: unknown,
  disallowedPatterns: string[],
): PolicyCheckResult {
  if (!parsedBody) return { allowed: true };

  const bodyStr = JSON.stringify(parsedBody).toLowerCase();

  for (const pattern of disallowedPatterns) {
    if (bodyStr.includes(pattern.toLowerCase())) {
      return {
        allowed: false,
        reason: `Request contains disallowed content pattern: "${pattern}".`,
        statusCode: 403,
      };
    }
  }

  return { allowed: true };
}
