"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

interface ActivityLogEntry {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  createdAt: string;
}

interface ActivityLogProps {
  logs: ActivityLogEntry[];
}

export function ActivityLog({ logs }: ActivityLogProps) {
  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      signup: "📝 Signed up",
      login: "🔑 Logged in",
      logout: "🚪 Logged out",
    };
    return labels[action] || action;
  };

  return (
    <Card className="border-[#333333] bg-[#121212]">
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start justify-between border-b border-[#333333] pb-3 last:border-0">
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium">{log.userEmail}</span> {getActionLabel(log.action)}
                </p>
              </div>
              <p className="text-xs text-[#A1A1AA]">
                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
              </p>
            </div>
          ))}

          {logs.length === 0 && (
            <p className="text-center text-[#A1A1AA] py-8">No activity yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
