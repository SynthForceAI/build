/**
 * Cross-tenant reference guard tests (lib/tenant.ts).
 *
 * These lock in the multi-tenant isolation rule: a company-scoped foreign key
 * may only reference a row inside the caller's own company. Every guard must
 *   (a) be a no-op for null/undefined ids (field not supplied),
 *   (b) scope its lookup by companyId (proven by asserting the where clause),
 *   (c) throw ApiError(400) with a stable code for a missing / foreign id.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDeptFindFirst = vi.fn();
const mockApiKeyFindFirst = vi.fn();
const mockUserFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    department: { findFirst: (...a: unknown[]) => mockDeptFindFirst(...a) },
    apiKey: { findFirst: (...a: unknown[]) => mockApiKeyFindFirst(...a) },
    user: { findFirst: (...a: unknown[]) => mockUserFindFirst(...a) },
  },
}));

import {
  assertDepartmentInCompany,
  assertApiKeyInCompany,
  assertManagerInCompany,
  assertAgentReferencesInCompany,
} from "@/lib/tenant";
import { ApiError } from "@/lib/api-errors";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.resetAllMocks());

const COMPANY = "company-1";

// ---------------------------------------------------------------------------
// assertDepartmentInCompany
// ---------------------------------------------------------------------------

describe("assertDepartmentInCompany", () => {
  it.each([undefined, null, ""])("no-ops (no DB call) when id is %s", async (id) => {
    await expect(assertDepartmentInCompany(COMPANY, id as string | null | undefined)).resolves.toBeUndefined();
    expect(mockDeptFindFirst).not.toHaveBeenCalled();
  });

  it("resolves when the department belongs to the company", async () => {
    mockDeptFindFirst.mockResolvedValueOnce({ id: "dept-1" });
    await expect(assertDepartmentInCompany(COMPANY, "dept-1")).resolves.toBeUndefined();
  });

  it("scopes the lookup by companyId", async () => {
    mockDeptFindFirst.mockResolvedValueOnce({ id: "dept-1" });
    await assertDepartmentInCompany(COMPANY, "dept-1");
    expect(mockDeptFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "dept-1", companyId: COMPANY } }),
    );
  });

  it("throws ApiError(400, department_not_found) for a foreign / missing id", async () => {
    mockDeptFindFirst.mockResolvedValueOnce(null); // scoped query returns nothing
    await expect(assertDepartmentInCompany(COMPANY, "dept-of-other-co")).rejects.toMatchObject({
      status: 400,
      code: "department_not_found",
    });
  });

  it("rejects with an ApiError instance (so handleApiError maps it to 400)", async () => {
    mockDeptFindFirst.mockResolvedValueOnce(null);
    await expect(assertDepartmentInCompany(COMPANY, "x")).rejects.toBeInstanceOf(ApiError);
  });
});

// ---------------------------------------------------------------------------
// assertApiKeyInCompany
// ---------------------------------------------------------------------------

describe("assertApiKeyInCompany", () => {
  it("no-ops when id is nullish", async () => {
    await expect(assertApiKeyInCompany(COMPANY, null)).resolves.toBeUndefined();
    expect(mockApiKeyFindFirst).not.toHaveBeenCalled();
  });

  it("resolves and scopes by companyId when the key belongs to the company", async () => {
    mockApiKeyFindFirst.mockResolvedValueOnce({ id: "key-1" });
    await assertApiKeyInCompany(COMPANY, "key-1");
    expect(mockApiKeyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "key-1", companyId: COMPANY } }),
    );
  });

  it("throws ApiError(400, api_key_not_found) for a foreign / missing id", async () => {
    mockApiKeyFindFirst.mockResolvedValueOnce(null);
    await expect(assertApiKeyInCompany(COMPANY, "key-of-other-co")).rejects.toMatchObject({
      status: 400,
      code: "api_key_not_found",
    });
  });
});

// ---------------------------------------------------------------------------
// assertManagerInCompany
// ---------------------------------------------------------------------------

describe("assertManagerInCompany", () => {
  it("no-ops when id is nullish", async () => {
    await expect(assertManagerInCompany(COMPANY, undefined)).resolves.toBeUndefined();
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });

  it("resolves and scopes by companyId when the user is a member", async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: "user-2" });
    await assertManagerInCompany(COMPANY, "user-2");
    expect(mockUserFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-2", companyId: COMPANY } }),
    );
  });

  it("throws ApiError(400, managed_by_not_in_company) for a user in another company", async () => {
    mockUserFindFirst.mockResolvedValueOnce(null);
    await expect(assertManagerInCompany(COMPANY, "victim-user-id")).rejects.toMatchObject({
      status: 400,
      code: "managed_by_not_in_company",
    });
  });
});

// ---------------------------------------------------------------------------
// assertAgentReferencesInCompany (composite)
// ---------------------------------------------------------------------------

describe("assertAgentReferencesInCompany", () => {
  it("validates all three references and resolves when each belongs to the company", async () => {
    mockDeptFindFirst.mockResolvedValueOnce({ id: "dept-1" });
    mockApiKeyFindFirst.mockResolvedValueOnce({ id: "key-1" });
    mockUserFindFirst.mockResolvedValueOnce({ id: "user-2" });

    await expect(
      assertAgentReferencesInCompany(COMPANY, {
        departmentId: "dept-1",
        apiKeyId: "key-1",
        managedBy: "user-2",
      }),
    ).resolves.toBeUndefined();

    expect(mockDeptFindFirst).toHaveBeenCalledTimes(1);
    expect(mockApiKeyFindFirst).toHaveBeenCalledTimes(1);
    expect(mockUserFindFirst).toHaveBeenCalledTimes(1);
  });

  it("only checks the references that are supplied", async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: "user-2" });
    await assertAgentReferencesInCompany(COMPANY, { managedBy: "user-2" });
    expect(mockDeptFindFirst).not.toHaveBeenCalled();
    expect(mockApiKeyFindFirst).not.toHaveBeenCalled();
    expect(mockUserFindFirst).toHaveBeenCalledTimes(1);
  });

  it("fails fast on the first cross-tenant reference (department) without checking the rest", async () => {
    mockDeptFindFirst.mockResolvedValueOnce(null); // foreign department
    await expect(
      assertAgentReferencesInCompany(COMPANY, {
        departmentId: "foreign-dept",
        apiKeyId: "key-1",
        managedBy: "user-2",
      }),
    ).rejects.toMatchObject({ code: "department_not_found" });
    // Short-circuits: later refs are never queried.
    expect(mockApiKeyFindFirst).not.toHaveBeenCalled();
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });

  it("surfaces a cross-tenant manager (the PII-leak vector) with the right code", async () => {
    mockUserFindFirst.mockResolvedValueOnce(null); // manager in another company
    await expect(
      assertAgentReferencesInCompany(COMPANY, { managedBy: "victim-user-id" }),
    ).rejects.toMatchObject({ status: 400, code: "managed_by_not_in_company" });
  });
});
