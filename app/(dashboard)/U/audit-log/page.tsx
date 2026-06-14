import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { AuditLogClient } from "@/components/ui/audit-log-client";

export default async function AuditLogPage() {
  let companyId: string;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const agents = await prisma.agent.findMany({
    where: { companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  }).catch(() => []);

  return (
    <Suspense>
      <AuditLogClient agents={agents} />
    </Suspense>
  );
}
