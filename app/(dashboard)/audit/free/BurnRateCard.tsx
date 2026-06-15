"use client";

import { useState, useEffect } from "react";

type Props = {
  dailyRateCents:  number | null;
  weeklyRateCents: number | null;
  trendPct:        number | null;
};

const LS_KEY = "synthforce_monthly_budget_cents";

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BurnRateCard({ dailyRateCents, weeklyRateCents, trendPct }: Props) {
  const [budget, setBudget]         = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [editing, setEditing]       = useState(false);
  const [mounted, setMounted]       = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(LS_KEY);
    if (stored) setBudget(Number(stored));
  }, []);

  function saveBudget() {
    const val = parseFloat(inputValue.replace(/[$,]/g, ""));
    if (isNaN(val) || val <= 0) return;
    const cents = Math.round(val * 100);
    localStorage.setItem(LS_KEY, String(cents));
    setBudget(cents);
    setEditing(false);
    setInputValue("");
  }

  function clearBudget() {
    localStorage.removeItem(LS_KEY);
    setBudget(null);
  }

  const hasRateData = dailyRateCents !== null && dailyRateCents > 0;
  const monthlyProjectionCents = hasRateData ? (dailyRateCents as number) * 30 : null;
  const overBudget = budget !== null && monthlyProjectionCents !== null && monthlyProjectionCents > budget;
  const daysRunway = budget !== null && hasRateData && dailyRateCents! > 0
    ? Math.floor(budget / dailyRateCents!)
    : null;

  const trendAbs   = trendPct !== null ? Math.abs(trendPct) : 0;
  const trendLabel = trendPct === null   ? null
    : trendAbs < 5 ? "Stable"
    : trendPct > 0 ? `+${Math.round(trendPct)}% vs prior week`
    : `${Math.round(trendPct)}% vs prior week`;
  const trendColor = trendPct === null   ? "text-gray-400"
    : trendPct > 10  ? "text-orange-600"
    : trendPct < -10 ? "text-green-600"
    : "text-gray-600";

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-6 ${overBudget ? "border-orange-200" : "border-gray-200"}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Burn Rate Forecast</h2>
        {mounted && budget !== null && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600">
            Edit budget
          </button>
        )}
      </div>

      {/* Rate metrics — only when we have 7+ days of data */}
      {hasRateData && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <div className="text-lg font-bold text-gray-900">{fmt(dailyRateCents!)}</div>
            <div className="text-xs text-gray-500">per day (7-day avg)</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">{fmt(weeklyRateCents!)}</div>
            <div className="text-xs text-gray-500">per week</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${trendColor}`}>{trendLabel}</div>
            <div className="text-xs text-gray-500">burn trend</div>
          </div>
        </div>
      )}

      {/* Budget wall — always visible until budget is set */}
      {(!mounted || (budget === null && !editing)) && (
        <button
          onClick={() => setEditing(true)}
          className="w-full py-3 text-sm font-medium border border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-gray-400 hover:text-gray-700 transition"
        >
          Set your monthly budget to see if you are on track
        </button>
      )}

      {mounted && editing && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 shrink-0">Monthly budget ($)</span>
          <input
            type="number"
            autoFocus
            min="1"
            placeholder="e.g. 500"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveBudget()}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00B2FF]/30 focus:border-[#00B2FF]"
          />
          <button
            onClick={saveBudget}
            className="px-3 py-2 text-sm font-medium bg-[#00B2FF] text-white rounded-lg hover:bg-[#00B2FF]/90 transition shrink-0"
          >
            Save
          </button>
          <button
            onClick={() => { setEditing(false); setInputValue(""); }}
            className="px-2 py-2 text-sm text-gray-400 hover:text-gray-600 shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {mounted && budget !== null && !editing && (
        <div className={`rounded-xl p-4 ${overBudget ? "bg-orange-50 border border-orange-200" : "bg-green-50 border border-green-200"}`}>
          {monthlyProjectionCents !== null && (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700">30-day projection</span>
                <span className={`text-sm font-bold ${overBudget ? "text-orange-600" : "text-green-700"}`}>
                  {fmt(monthlyProjectionCents)}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Your budget</span>
                <span className="text-xs text-gray-500">{fmt(budget)}</span>
              </div>
            </>
          )}
          {overBudget && dailyRateCents ? (
            <p className="text-xs text-orange-600 font-medium">
              Over budget. At {fmt(dailyRateCents)}/day you have {daysRunway} days of runway before your {fmt(budget)} monthly budget runs out.
            </p>
          ) : (
            <p className="text-xs text-green-700">
              {daysRunway !== null ? `On track. ${daysRunway} days of runway at this burn rate.` : `Budget is set at ${fmt(budget)}/month.`}
            </p>
          )}
          <button onClick={clearBudget} className="text-xs text-gray-300 hover:text-gray-500 mt-3 block">
            Clear budget
          </button>
        </div>
      )}

      {hasRateData && (
        <p className="text-xs text-gray-400 mt-3">
          Based on 7-day average daily spend from the audit period.
        </p>
      )}
    </div>
  );
}
