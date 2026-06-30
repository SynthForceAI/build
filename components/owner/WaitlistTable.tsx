"use client";

import { formatDistanceToNow } from "date-fns";

interface WaitlistRow {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  role: string | null;
  createdAt: string;
}

export function WaitlistTable({ rows }: { rows: WaitlistRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-md border border-gray-200 shadow-sm px-5 py-10 text-center text-sm text-gray-400">
        No waitlist signups yet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs">Email</th>
              <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs">Company</th>
              <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs">Signed Up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((w) => (
              <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-900">{w.email}</td>
                <td className="px-5 py-3 text-gray-600">{w.name ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-3 text-gray-600">{w.company ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-3 text-gray-500">
                  {formatDistanceToNow(new Date(w.createdAt), { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
