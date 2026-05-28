/**
 * Offboarding page — deactivate agents, track audit trail, and manage archives.
 *
 * Sections:
 *   1. Stat cards       — total deactivated, pending offboarding, avg offboard time
 *   2. Offboard Agent   — select active agent, fill reason/date, complete checklist
 *   3. Archived Agents  — deactivated agents from real DB + mock archive metadata
 *   4. Audit Trail      — mock log; TODO wire to a real audit_events table
 *
 * Data strategy:
 *   - Active agents and deactivated agents pulled from Prisma (real).
 *   - archivedAt, offboardedBy, auditTrail are mock — no audit_events table yet.
 *     TODO: add AuditEvent model to schema then replace MOCK_* constants.
 *   - "Complete Offboarding" button is wired via OffboardingClient component
 *     to PUT /api/agents/:id (sets status → "deactivated") when ready.
 */

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { OffboardingClient } from "./components/OffboardingClient";

// ── Types ──────────────────────────────────────────────────────────────────

export type ActiveAgentOption = {
  id: string;
  name: string;
  department: string | null;
  spendCents: number;
};

export type ArchivedAgent = {
  id: string;
  name: string;
  department: string | null;
  deactivatedAt: string;     // ISO — real from DB when available
  offboardedBy: string;      // mock until audit table exists
  finalSpendCents: number;   // real from currentMonthSpendCents
  tasksCompleted: number;    // mock — TODO wire to usageLog count
};

export type AuditEntry = {
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
};

// ── Mock data ──────────────────────────────────────────────────────────────
// TODO: replace with real audit_events table queries

const MOCK_AUDIT_TRAIL: AuditEntry[] = [
  {
    timestamp: "2026-05-20 14:32",
    actor: "admin@acme.com",
    action: "Agent Deactivated",
    detail: "Expense Auditor · reason: Project completed",
  },
  {
    timestamp: "2026-05-18 09:15",
    actor: "manager@acme.com",
    action: "Access Revoked",
    detail: "Expense Auditor · provider keys rotated",
  },
  {
    timestamp: "2026-05-15 11:00",
    actor: "admin@acme.com",
    action: "Agent Deactivated",
    detail: "Lead Gen v1 · reason: Replaced by Lead Gen v2",
  },
  {
    timestamp: "2026-05-10 08:45",
    actor: "system",
    action: "Budget Cleared",
    detail: "Lead Gen v1 · monthly budget set to $0",
  },
];

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmtDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function OffboardingPage() {
  let companyId: string;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/");
    throw err;
  }

  // Fetch active agents for the offboard form dropdown
  const activeAgentsRaw = await prisma.agent.findMany({
    where:   { companyId, status: "active" },
    orderBy: { name: "asc" },
    include: { department: { select: { name: true } } },
  }).catch(() => []);

  // Fetch deactivated agents for the archive table
  const deactivatedRaw = await prisma.agent.findMany({
    where:   { companyId, status: "deactivated" },
    orderBy: { updatedAt: "desc" },
    include: { department: { select: { name: true } } },
  }).catch(() => []);

  const activeAgents: ActiveAgentOption[] = activeAgentsRaw.map((a) => ({
    id:          a.id,
    name:        a.name,
    department:  a.department?.name ?? null,
    spendCents:  Number(a.currentMonthSpendCents),
  }));

  const archivedAgents: ArchivedAgent[] = deactivatedRaw.map((a) => ({
    id:              a.id,
    name:            a.name,
    department:      a.department?.name ?? null,
    deactivatedAt:   a.updatedAt.toISOString(),
    offboardedBy:    "admin",              // TODO: pull from audit_events
    finalSpendCents: Number(a.currentMonthSpendCents),
    tasksCompleted:  0,                    // TODO: wire to usageLog count
  }));

  const pendingCount    = activeAgents.length;  // active agents that could be offboarded
  const deactivatedCount = archivedAgents.length;

  return (
    <div className="space-y-8">

      {/* ── Page header ──────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent Offboarding</h1>
        <p className="text-sm text-gray-500 mt-1">
          Deactivate agents, revoke access, and maintain audit trails.
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Stat value={String(deactivatedCount)} label="Total Archived Agents" tone="bg-gray-50"   />
        <Stat value={String(pendingCount)}     label="Active (eligible)"     tone="bg-blue-50"   />
        <Stat value="2.4 days"                 label="Avg. Offboard Time"    tone="bg-purple-50" />
        {/* TODO: derive avg offboard time from audit_events timestamps */}
      </div>

      {/* ── Offboard + Archive grid ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left: Offboard Agent form */}
        <OffboardingClient activeAgents={activeAgents} />

        {/* Right: Offboarding checklist */}
        <div className="bg-gray-50 p-6 rounded-xl">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Offboarding Checklist</h3>
          <p className="text-xs text-gray-500 mb-4">
            Complete all steps before marking an agent as archived.
          </p>
          <div className="space-y-3">
            {[
              { label: "Revoke provider API key access",          note: "Rotated at source — OpenAI, Anthropic, etc." },
              { label: "Export usage logs and audit trail",        note: "Data retained for 90 days post-offboarding" },
              { label: "Notify department manager",               note: "Email sent automatically on completion" },
              { label: "Clear active task queue",                 note: "Drain any in-flight jobs before deactivation" },
              { label: "Update dependent workflows",              note: "Remove agent from pipelines that call it" },
              { label: "Archive guardrail policies",              note: "Policies stored for compliance reference" },
            ].map((item, i) => (
              <label key={i} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[#00B2FF] rounded shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800 group-hover:text-gray-900 transition">
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.note}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ── Archived agents table ─────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Archived Agents</h2>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {archivedAgents.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-500">No archived agents.</p>
              <p className="text-xs text-gray-400 mt-1">
                Deactivated agents will appear here with their final spend and audit record.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[700px]">
                <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-medium">Agent</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Deactivated</th>
                    <th className="px-4 py-3 font-medium">By</th>
                    <th className="px-4 py-3 font-medium text-right">Final Spend</th>
                    <th className="px-4 py-3 font-medium text-right">Tasks</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedAgents.map((agent) => (
                    <tr
                      key={agent.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{agent.name}</td>
                      <td className="px-4 py-3 text-gray-600">{agent.department ?? "Unassigned"}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(agent.deactivatedAt)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{agent.offboardedBy}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        {fmtDollars(agent.finalSpendCents)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {agent.tasksCompleted.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Archived
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Audit trail ──────────────────────────────────── */}
      {/* TODO: replace MOCK_AUDIT_TRAIL with real audit_events table queries */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Audit Trail</h2>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {MOCK_AUDIT_TRAIL.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-500">No audit events recorded.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {MOCK_AUDIT_TRAIL.map((entry, i) => (
                <li key={i} className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50/50 transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-900">{entry.action}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{entry.actor}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{entry.detail}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{entry.timestamp}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

function Stat({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className={`${tone} p-6 rounded-xl`}>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  );
}
