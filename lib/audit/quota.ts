/**
 * Free-audit quota — the "one free audit" moat.
 *
 * A free-tier company may have exactly one audit that "counts" (status
 * pending / processing / completed). Failed and cancelled attempts do not
 * burn the quota, mirroring the connect flow's zombie-key cleanup: a broken
 * attempt should never cost the user their single free run.
 *
 * Paid tiers (starter / team / enterprise) are unlimited.
 *
 * This module is the single source of truth for the limit. Both the API
 * routes (backend enforcement) and the audit report page (UI gating) call
 * into it so they can never disagree.
 */
import { prisma } from "../db";
import { ApiError } from "../api-errors";
import type { SubscriptionTier } from "@prisma/client";

/** Number of free audits a free-tier company gets, total. */
export const FREE_AUDIT_LIMIT = 1;

/** Tiers with unlimited audits. */
const UNLIMITED_TIERS: SubscriptionTier[] = ["starter", "team", "enterprise"];

/** Audit statuses that consume the quota (anything that isn't a dead attempt). */
const COUNTED_STATUSES = ["pending", "processing", "completed"] as const;

export type AuditQuota = {
  tier: SubscriptionTier;
  /** Max audits allowed, or null when unlimited. */
  limit: number | null;
  /** Audits that have consumed quota so far. */
  used: number;
  /** Audits remaining, or null when unlimited. */
  remaining: number | null;
  /** Whether the company may start another audit. */
  canRun: boolean;
};

export async function getAuditQuota(companyId: string): Promise<AuditQuota> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscriptionTier: true },
  });
  const tier = company?.subscriptionTier ?? "free";

  const used = await prisma.audit.count({
    where: {
      companyId,
      status: { in: [...COUNTED_STATUSES] },
    },
  });

  if (UNLIMITED_TIERS.includes(tier)) {
    return { tier, limit: null, used, remaining: null, canRun: true };
  }

  const remaining = Math.max(0, FREE_AUDIT_LIMIT - used);
  return { tier, limit: FREE_AUDIT_LIMIT, used, remaining, canRun: remaining > 0 };
}

/**
 * Throws ApiError(403) when the company has exhausted its free audit.
 * Call before creating any new audit for an authenticated company.
 */
export async function assertCanRunAudit(companyId: string): Promise<void> {
  const quota = await getAuditQuota(companyId);
  if (!quota.canRun) {
    throw new ApiError(403, "audit_limit_reached", {
      detail: "You've used your free audit. Upgrade to run more.",
    });
  }
}
