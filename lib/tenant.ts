/**
 * Cross-tenant reference guards.
 *
 * SynthForce is multi-tenant: every domain row carries a `companyId` and a
 * caller may only ever reference rows that live inside their OWN company.
 * Prisma performs no automatic tenant isolation, so any company-scoped foreign
 * key that arrives in a request body has to be validated explicitly.
 *
 * The create handlers (POST /api/agents, POST /api/policies) already did this
 * inline; the matching update handlers and the provider-connect flow did not,
 * which let an authenticated user re-point one of their own records at another
 * tenant's row. That row's data then leaks back through the response's
 * `include` relations — most damagingly `agent.manager.{email,name}` (another
 * company's user PII) but also department names, etc. This module centralises
 * the checks so every write path enforces the same rule.
 *
 * Design notes:
 * - Each guard is a no-op when the id is null/undefined (the field simply
 *   wasn't supplied), so callers can pass optional fields straight through.
 * - A present-but-foreign id throws the SAME 400 as a missing id, so we never
 *   confirm the existence of another tenant's identifier (no oracle).
 * - `providerId` / `modelId` are intentionally NOT covered: Provider and
 *   ProviderModel are global catalog tables (no `companyId`), shared by every
 *   tenant, so there is nothing to isolate.
 */
import { prisma } from "./db";
import { ApiError } from "./api-errors";

/** Throw ApiError(400) unless `departmentId` belongs to `companyId`. */
export async function assertDepartmentInCompany(
  companyId: string,
  departmentId: string | null | undefined,
): Promise<void> {
  if (!departmentId) return;
  const found = await prisma.department.findFirst({
    where: { id: departmentId, companyId },
    select: { id: true },
  });
  if (!found) {
    throw new ApiError(400, "department_not_found", {
      detail: "Department not found in your company.",
    });
  }
}

/** Throw ApiError(400) unless `apiKeyId` belongs to `companyId`. */
export async function assertApiKeyInCompany(
  companyId: string,
  apiKeyId: string | null | undefined,
): Promise<void> {
  if (!apiKeyId) return;
  const found = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, companyId },
    select: { id: true },
  });
  if (!found) {
    throw new ApiError(400, "api_key_not_found", {
      detail: "API key not found in your company.",
    });
  }
}

/** Throw ApiError(400) unless the manager `userId` belongs to `companyId`. */
export async function assertManagerInCompany(
  companyId: string,
  managedBy: string | null | undefined,
): Promise<void> {
  if (!managedBy) return;
  const found = await prisma.user.findFirst({
    where: { id: managedBy, companyId },
    select: { id: true },
  });
  if (!found) {
    throw new ApiError(400, "managed_by_not_in_company", {
      detail: "Manager is not a member of your company.",
    });
  }
}

/**
 * Validate every company-scoped foreign key that can appear on an Agent
 * create/update payload. Checks run in a stable order (department, apiKey,
 * manager) so the surfaced error code is deterministic.
 */
export async function assertAgentReferencesInCompany(
  companyId: string,
  refs: {
    departmentId?: string | null;
    apiKeyId?: string | null;
    managedBy?: string | null;
  },
): Promise<void> {
  await assertDepartmentInCompany(companyId, refs.departmentId);
  await assertApiKeyInCompany(companyId, refs.apiKeyId);
  await assertManagerInCompany(companyId, refs.managedBy);
}
