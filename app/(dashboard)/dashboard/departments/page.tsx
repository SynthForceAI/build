/*
 * Departments page
*/

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Department = {
    id: string;
    name: string;
    agentCount: number;
    budgetCents: number;
};

//fetch data from the DB directly for the server functionality
async function fetchDepartments(companyId: string){
    const rows = await prisma.department.findMany({
        where: { companyId },
        include: {
            _count: { select: { agents: true } } // count agents per dept
        }
      });
      return rows.map((d) => ({
        id: d.id,
        name: d.name,
        agentCount: d._count.agents,
        budgetCents: Number(d.monthlyBudgetCents),
    }));
}

// Page component
export default async function DepartmentsPage() {
    // ── TEMP: silent auth bypass — restore redirect before merging to nextjs-migration ──
    // Same pattern as app/(dashboard)/dashboard/page.tsx. When restoring:
    //   catch (err) {
    //     if (err instanceof ApiError && err.status === 401) redirect("/");
    //     throw err;
    //   }
    // and add: import { redirect } from "next/navigation"; import { ApiError } ...
    // ── END TEMP ──────────────────────────────────────────────────────────────────────
    let companyId: string | null = null;
    try {
      const { user } = await requireUser();
      companyId = user.companyId;
    } catch {
      companyId = "08e2e455-c6eb-4c57-b94b-4faeb7dc1942"; // TEMP: swallows 401 during dev; real code should redirect
    }
    let departments: Department[] = [];
    if (companyId) {
        try {
          departments = await fetchDepartments(companyId);
        } catch {
          departments = [];
        }
      }
  
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Departments</h1>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {departments.length === 0 ? (
            /* Empty state — shown before any agents have been created */
            <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">No departments created yet.</p>
            <p className="text-xs text-gray-400 mt-1 mb-6">
              Onboard your first AI agent and assign it to a department to start tracking spend and status.
            </p>
            <a
              href="/dashboard/agents"
              className="px-4 py-2 text-sm bg-[#00B2FF] text-white rounded-lg hover:bg-transparent hover:text-[#00B2FF] border border-[#00B2FF] transition"
            >
              Go to Agents
            </a>
          </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Agents</th>
                  <th className="px-4 py-3 font-medium text-right">Monthly Budget</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => {
  
                  return (
                    <tr
                      key={department.id}
                      className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{department.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          {department.agentCount} agents
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        ${(department.budgetCents / 100).toLocaleString()}/mo
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    );
}