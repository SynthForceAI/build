import { Button } from "@/components/ui/button";
import { UserList } from "@/components/owner/UserList";
import { ActivityLog } from "@/components/owner/ActivityLog";
import Link from "next/link";

async function getUsers() {
  const response = await fetch(
    new URL("/api/users", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return { users: [] };
  }

  return response.json();
}

async function getActivityLogs() {
  const response = await fetch(
    new URL("/api/activity-logs", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return { logs: [], total: 0 };
  }

  return response.json();
}

export default async function OwnerUsersPage() {
  const { users = [] } = await getUsers();
  const { logs = [] } = await getActivityLogs();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED]">
      {/* Header */}
      <div className="border-b border-[#333333] px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">SynthForce Owner Dashboard</h1>
          <form
            action={async () => {
              "use server";
              await fetch("/api/auth/logout", { method: "POST" });
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
          {/* Users Section */}
          <div>
            <UserList users={users} />
          </div>

          {/* Activity Log Section */}
          <div>
            <ActivityLog logs={logs} />
          </div>
        </div>
      </div>
    </div>
  );
}
