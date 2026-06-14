import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { VirtualKeyDisplay } from "@/components/ui/virtual-key-display";
import { decimalToJson } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

const STATUS_PILL: Record<string, string> = {
  active:      "bg-green-100 text-green-800",
  paused:      "bg-yellow-100 text-yellow-800",
  flagged:     "bg-red-100 text-red-800",
  deactivated: "bg-gray-100 text-gray-600",
};

function fmtDollars(cents: number) {
  return `$${(cents / 100).toFixed(4)}`;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function AgentDetailPage({ params }: Ctx) {
  let companyId: string;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const { id } = await params;

  const [agent, virtualKey, recentLogs] = await Promise.all([
    prisma.agent.findFirst({
      where: { id, companyId },
      include: {
        department: { select: { id: true, name: true } },
        provider:   { select: { id: true, name: true, displayName: true } },
        model:      { select: { id: true, modelId: true, displayName: true } },
        manager:    { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.agentVirtualKey.findFirst({
      where: { agentId: id, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { virtualKey: true, createdAt: true, lastUsedAt: true },
    }).catch(() => null),
    prisma.usageLog.findMany({
      where: { agentId: id, companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id:        true,
        tokensIn:  true,
        tokensOut: true,
        costCents: true,
        statusCode: true,
        wasBlocked: true,
        metadata:  true,
        createdAt: true,
      },
    }).catch(() => []),
  ]);

  if (!agent) notFound();

  const totalCost = recentLogs.reduce((sum, r) => sum + Number(decimalToJson(r.costCents) ?? 0), 0);
  const totalTokensIn  = recentLogs.reduce((sum, r) => sum + r.tokensIn, 0);
  const totalTokensOut = recentLogs.reduce((sum, r) => sum + r.tokensOut, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Back link */}
      <Link href="/U/agents" className="text-sm text-gray-500 hover:text-[#00B2FF] transition-colors">
        &larr; Back to Agents
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
          {agent.description && (
            <p className="text-sm text-gray-500 mt-1">{agent.description}</p>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-mono capitalize shrink-0 ${STATUS_PILL[agent.status] ?? "bg-gray-100 text-gray-600"}`}>
          {agent.status}
        </span>
      </div>

      {/* Virtual Key — Blocker 1 */}
      {virtualKey ? (
        <VirtualKeyDisplay
          virtualKey={virtualKey.virtualKey}
          createdAt={virtualKey.createdAt.toISOString()}
          lastUsedAt={virtualKey.lastUsedAt?.toISOString() ?? null}
        />
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-5 text-center">
          <p className="text-sm text-gray-500">No virtual key assigned to this agent yet.</p>
          <p className="text-xs text-gray-400 mt-1">Generate one to start routing requests through SynthForce.</p>
        </div>
      )}

      {/* Agent metadata */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Agent Details</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">Provider</dt>
            <dd className="font-medium text-gray-900">{agent.provider?.displayName ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">Model</dt>
            <dd className="font-medium text-gray-900">{agent.model?.displayName ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">Department</dt>
            <dd className="font-medium text-gray-900">{agent.department?.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">Manager</dt>
            <dd className="font-medium text-gray-900">{agent.manager?.name ?? agent.manager?.email ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">Monthly Budget</dt>
            <dd className="font-medium text-gray-900">${(Number(agent.monthlyBudgetCents) / 100).toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">Log Full Content</dt>
            <dd className="font-medium text-gray-900">{agent.logFullContent ? "On" : "Off"}</dd>
          </div>
        </dl>
      </div>

      {/* Proxy usage summary (last 20 requests) */}
      {recentLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Proxy Usage (last 20 requests)</h2>
          <div className="grid grid-cols-3 gap-4 mb-5 pb-4 border-b border-gray-100 text-center">
            <div>
              <div className="text-lg font-bold text-gray-900">${totalCost.toFixed(4)}</div>
              <div className="text-xs text-gray-500">Total cost</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{fmtTokens(totalTokensIn)}</div>
              <div className="text-xs text-gray-500">Tokens in</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{fmtTokens(totalTokensOut)}</div>
              <div className="text-xs text-gray-500">Tokens out</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[540px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">Model</th>
                  <th className="pb-2 font-medium text-right">Tokens in</th>
                  <th className="pb-2 font-medium text-right">Tokens out</th>
                  <th className="pb-2 font-medium text-right">Cost</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((row) => {
                  const meta = row.metadata as Record<string, unknown>;
                  return (
                    <tr key={row.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 text-gray-500 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 text-gray-700">{String(meta?.model ?? "-")}</td>
                      <td className="py-2 text-right font-mono text-gray-700">{row.tokensIn}</td>
                      <td className="py-2 text-right font-mono text-gray-700">{row.tokensOut}</td>
                      <td className="py-2 text-right font-mono text-gray-700">
                        {fmtDollars(Number(decimalToJson(row.costCents) ?? 0))}
                      </td>
                      <td className="py-2">
                        {row.wasBlocked ? (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">Blocked</span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                            {row.statusCode ?? "OK"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-right">
            <Link href={`/U/audit-log?agentId=${agent.id}`} className="text-xs text-[#00B2FF] hover:underline">
              View full audit log &rarr;
            </Link>
          </div>
        </div>
      )}

      {recentLogs.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
          <p className="text-sm text-gray-500">No proxy requests logged yet.</p>
          <p className="text-xs text-gray-400 mt-1">Once your agent routes requests through its virtual key, usage will appear here.</p>
        </div>
      )}
    </div>
  );
}
