/**
 * Tenant-scoping guards for foreign-key references supplied in request bodies.
 *
 * Platform invariant: every FK a caller passes (departmentId, apiKeyId,
 * managedBy, scopeDepartmentId, …) MUST resolve to a row inside the caller's
 * OWN company. Skipping this lets an authenticated user point one of their own
 * records at another tenant's row — a cross-tenant IDOR / broken-object-level-
 * authorization bug (e.g. linking an agent to another company's API key, or
 * naming another company's user as its manager, which then leaks that user's
 * email/name back in the agent response).
 *
 * These helpers throw `ApiError(400, <code>)` so route handlers use them inside
 * their existing `try { … } catch (err) { return handleApiError(err); }` flow.
 * Centralising the checks here keeps the create and update paths in lock-step:
 * historically the POST handlers validated FKs but the PATCH handlers did not,
 * which is exactly the gap this module closes.
 */
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-errors";

/** Throw unless `departmentId` is a department in `companyId`. */
export async function assertDepartmentInCompany(
  departmentId: string,
  companyId: string,
): Promise<void> {
  const ok = await prisma.department.findFirst({
    where: { id: departmentId, companyId },
    select: { id: true },
  });
  if (!ok) {
    throw new ApiError(400, "department_not_found", {
      detail: "Department not found in your workspace.",
    });
  }
}

/** Throw unless `apiKeyId` is an API key owned by `companyId`. */
export async function assertApiKeyInCompany(
  apiKeyId: string,
  companyId: string,
): Promise<void> {
  const ok = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, companyId },
    select: { id: true },
  });
  if (!ok) {
    throw new ApiError(400, "api_key_not_found", {
      detail: "API key not found in your workspace.",
    });
  }
}

/** Throw unless `userId` is a member of `companyId` (agent manager). */
export async function assertManagerInCompany(
  userId: string,
  companyId: string,
): Promise<void> {
  const ok = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true },
  });
  if (!ok) {
    throw new ApiError(400, "managed_by_not_in_company", {
      detail: "Manager must be a user in your workspace.",
    });
  }
}

/**
 * Validate every company-scoped FK that an Agent create/update body may carry.
 * `providerId` / `modelId` are intentionally NOT checked here: providers and
 * models are global seeded catalog rows, not per-tenant resources.
 *
 * Only truthy values are checked, so:
 *   - `undefined` (field omitted)  → no change, skipped
 *   - `null`       (explicit unset) → allowed, skipped
 *   - a UUID string                → must belong to `companyId`
 */
export async function assertAgentRefsInCompany(
  data: {
    departmentId?: string | null;
    apiKeyId?: string | null;
    managedBy?: string | null;
  },
  companyId: string,
): Promise<void> {
  if (data.departmentId) await assertDepartmentInCompany(data.departmentId, companyId);
  if (data.apiKeyId)     await assertApiKeyInCompany(data.apiKeyId, companyId);
  if (data.managedBy)    await assertManagerInCompany(data.managedBy, companyId);
}
