"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { SubscriptionTier } from "@prisma/client";
import { PLANS, isUpgrade, type Plan } from "@/lib/billing/plans";

const SALES_EMAIL = "sales@synthforceai.com";

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-[#00B2FF] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlanCard({ plan, currentTier }: { plan: Plan; currentTier: SubscriptionTier }) {
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);

  const isCurrent = plan.tier === currentTier;
  const upgradeable = isUpgrade(currentTier, plan.tier);

  async function handleUpgrade() {
    if (plan.contactSales) {
      window.location.href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Enterprise plan enquiry")}`;
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/billing/upgrade-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: plan.tier }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error?.detail ?? data?.error?.message ?? "Something went wrong. Try again.";
        toast.error(msg);
        return;
      }
      // Stripe path (future): server returns a hosted checkout URL to redirect to.
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }
      setRequested(true);
      toast.success(`Thanks! We'll reach out to set up your ${plan.name} plan.`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 bg-white ${
        plan.featured ? "border-[#00B2FF] shadow-md" : "border-gray-200 shadow-sm"
      }`}
    >
      {plan.featured && (
        <span className="absolute -top-3 left-6 text-xs font-semibold px-3 py-1 rounded-full bg-[#00B2FF] text-white">
          Most popular
        </span>
      )}

      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
      <div className="mt-1 mb-1">
        <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
        {plan.cadence && <span className="text-sm text-gray-400">{plan.cadence}</span>}
      </div>
      <p className="text-sm text-gray-500 mb-5 min-h-[40px]">{plan.tagline}</p>

      <ul className="space-y-2.5 mb-6 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
            <CheckIcon />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <span className="w-full text-center px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-500 cursor-default">
          Current plan
        </span>
      ) : requested ? (
        <span className="w-full text-center px-4 py-2.5 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200">
          Request received ✓
        </span>
      ) : upgradeable || plan.contactSales ? (
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
            plan.featured
              ? "bg-[#00B2FF] text-white hover:bg-[#00B2FF]/90"
              : "border border-[#00B2FF] text-[#00B2FF] hover:bg-blue-50"
          }`}
        >
          {loading && (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {plan.cta}
        </button>
      ) : (
        <span className="w-full text-center px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-50 text-gray-400 border border-gray-200 cursor-default">
          Included
        </span>
      )}
    </div>
  );
}

export function PlanGrid({ currentTier }: { currentTier: SubscriptionTier }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {PLANS.map((plan) => (
        <PlanCard key={plan.tier} plan={plan} currentTier={currentTier} />
      ))}
    </div>
  );
}
