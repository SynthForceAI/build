import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { getAuditQuota } from "@/lib/audit/quota";
import { planForTier } from "@/lib/billing/plans";
import { PlanGrid } from "./components/PlanGrid";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  let companyId: string;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  // Stripe Checkout return states (see lib/billing/config.ts checkoutReturnUrls).
  const { upgrade } = await searchParams;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscriptionTier: true },
  });
  const tier = company?.subscriptionTier ?? "free";
  const currentPlan = planForTier(tier);
  const quota = await getAuditQuota(companyId);

  const auditUsage =
    quota.limit === null
      ? "Unlimited audits"
      : `${quota.used} of ${quota.limit} free ${quota.limit === 1 ? "audit" : "audits"} used`;

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Billing &amp; Plans</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your subscription and unlock unlimited audits.
        </p>
      </div>

      {upgrade === "success" && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm mb-6">
          Your upgrade is being processed. Your plan will update once payment is confirmed.
        </div>
      )}
      {upgrade === "cancelled" && (
        <div className="bg-gray-50 border border-gray-200 text-gray-600 rounded-xl px-4 py-3 text-sm mb-6">
          Checkout cancelled. You can pick a plan whenever you&apos;re ready.
        </div>
      )}

      {/* ── Current plan summary ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Current plan</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-[#00B2FF] border border-blue-100 font-medium capitalize">
                {currentPlan.name}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {currentPlan.price}
              {currentPlan.cadence && (
                <span className="text-sm font-normal text-gray-400">{currentPlan.cadence}</span>
              )}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">{auditUsage}</p>
          </div>
          {!quota.canRun && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 max-w-sm">
              You&apos;ve used your free audit. Upgrade to a paid plan to re-run audits anytime.
            </div>
          )}
        </div>
      </div>

      {/* ── Plan grid ────────────────────────────────────────────────────── */}
      <PlanGrid currentTier={tier} />

      <p className="text-xs text-gray-400 mt-8 text-center">
        Questions about billing? Email{" "}
        <a href="mailto:samarth@synthforceai.com" className="text-[#00B2FF] hover:underline">
          samarth@synthforceai.com
        </a>
        .
      </p>
    </div>
  );
}
