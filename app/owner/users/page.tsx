import { redirect } from "next/navigation";
import { UserList } from "@/components/owner/UserList";
import { ActivityLog } from "@/components/owner/ActivityLog";
import { requireUser, isOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Platform-owner dashboard. As a Server Component it enforces the session +
 * owner check itself and reads the database directly — no round-trip to our
 * own API (which would not carry the caller's auth cookies anyway).
 */
export default async function OwnerUsersPage() {
  let email: string | undefined;
  try {
    const { user } = await requireUser();
    email = user.email;
  } catch {
    redirect("/login");
  }
  if (!isOwner(email)) redirect("/U");

  const [users, logRows] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, createdAt: true, lastLoginAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityLog.findMany({
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const logs = logRows.map((log) => ({
    id:        log.id,
    userId:    log.userId,
    userEmail: log.user.email,
    action:    log.action,
    createdAt: log.createdAt,
  }));

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED]">
      {/* Header */}
      <div className="border-b border-[#333333] px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">SynthForce Owner Dashboard</h1>
          <form
            action={async () => {
              "use server";
              const supabase = await createSupabaseServerClient();
              await supabase.auth.signOut();
              redirect("/login");
            }}
          >
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-[#EDEDED] border border-[#333333] rounded-md hover:bg-[#121212]"
            >
              Log Out
            </button>
          </form>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid gap-8">
          <div>
            <UserList users={users as never} />
          </div>
          <div>
            <ActivityLog logs={logs as never} />
          </div>
        </div>
      </div>
    </div>
  );
}
