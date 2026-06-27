interface Stats {
  totalUsers: number;
  signupsThisWeek: number;
  completedAudits: number;
  pendingUpgrades: number;
}

export function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      sub: `${stats.signupsThisWeek} this week`,
      color: "text-[#00B2FF]",
      bg: "bg-blue-50",
    },
    {
      label: "Signups This Week",
      value: stats.signupsThisWeek,
      sub: "last 7 days",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Audits Completed",
      value: stats.completedAudits,
      sub: "all time",
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Upgrade Requests",
      value: stats.pendingUpgrades,
      sub: "pending follow-up",
      color: stats.pendingUpgrades > 0 ? "text-amber-600" : "text-gray-400",
      bg: stats.pendingUpgrades > 0 ? "bg-amber-50" : "bg-gray-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{c.label}</p>
          <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
          <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
