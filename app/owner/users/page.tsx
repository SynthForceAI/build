import { redirect } from "next/navigation";
import { requireUser, isOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { StatsCards } from "@/components/owner/StatsCards";
import { UsersTable } from "@/components/owner/UsersTable";
import { UpgradeRequestsTable } from "@/components/owner/UpgradeRequestsTable";
import { WaitlistTable } from "@/components/owner/WaitlistTable";
import { ActivityFeed } from "@/components/owner/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function OwnerDashboard() {
  let email: string | undefined;
  try {
    const { user } = await requireUser();
    email = user.email;
  } catch {
    redirect("/login");
  }
  if (!isOwner(email)) redirect("/U");

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [
    users,
    totalUsers,
    signupsThisWeek,
    completedAudits,
    pendingUpgrades,
    upgradeRequests,
    waitlist,
    activityLogs,
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        createdAt: true,
        lastLoginAt: true,
        company: {
          select: {
            subscriptionTier: true,
            _count: { select: { audits: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
    prisma.audit.count({ where: { status: "completed" } }),
    prisma.upgradeRequest.count({ where: { status: "pending" } }),
    prisma.upgradeRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.waitlistSignup.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, email: true, name: true, company: true, role: true, createdAt: true },
    }),
    prisma.activityLog.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);

  const stats = { totalUsers, signupsThisWeek, completedAudits, pendingUpgrades };

  const userRows = users.map((u) => ({
    id: u.id,
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    tier: u.company?.subscriptionTier ?? "free",
    auditCount: u.company?._count.audits ?? 0,
  }));

  const upgradeRows = upgradeRequests.map((r) => ({
    id: r.id,
    email: r.email,
    tier: r.tier,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  const waitlistRows = waitlist.map((w) => ({
    id: w.id,
    email: w.email,
    name: w.name ?? null,
    company: w.company ?? null,
    role: w.role ?? null,
    createdAt: w.createdAt.toISOString(),
  }));

  const activityRows = activityLogs.map((l) => ({
    id: l.id,
    email: l.user.email,
    action: l.action,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#00B2FF] flex items-center justify-center">
              <span className="text-white font-bold text-xs">SF</span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">Owner Dashboard</h1>
              <p className="text-xs text-gray-400">{email}</p>
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              const supabase = await createSupabaseServerClient();
              await supabase.auth.signOut();
              const { cookies } = await import("next/headers");
              const store = await cookies();
              store.delete("synthforce-intro-played");
              redirect("/login");
            }}
          >
            <button
              type="submit"
              className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <StatsCards stats={stats} />

        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Upgrade Requests
          </h2>
          <UpgradeRequestsTable rows={upgradeRows} />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Users ({totalUsers})
          </h2>
          <UsersTable rows={userRows} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
              Waitlist ({waitlist.length})
            </h2>
            <WaitlistTable rows={waitlistRows} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
              Recent Activity
            </h2>
            <ActivityFeed rows={activityRows} />
          </section>
        </div>
      </main>
    </div>
  );
}
