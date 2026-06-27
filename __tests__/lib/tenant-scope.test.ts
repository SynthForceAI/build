import { afterEach, describe, expect, it, vi } from "vitest";

// lib/tenant-scope only touches the DB and ApiError. Mock the Prisma client so
// these are pure unit tests of the guard logic (no real DB).
const mockDeptFindFirst    = vi.fn();
const mockApiKeyFindFirst  = vi.fn();
const mockUserFindFirst    = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    department: { findFirst: (...a: unknown[]) => mockDeptFindFirst(...a) },
    apiKey:     { findFirst: (...a: unknown[]) => mockApiKeyFindFirst(...a) },
    user:       { findFirst: (...a: unknown[]) => mockUserFindFirst(...a) },
  },
}));

import {
  assertDepartmentInCompany,
  assertApiKeyInCompany,
  assertManagerInCompany,
  assertAgentRefsInCompany,
} from "@/lib/tenant-scope";
import { ApiError } from "@/lib/api-errors";

const COMPANY = "company-A";
const OTHER   = "company-B";

afterEach(() => vi.resetAllMocks());

// ---------------------------------------------------------------------------
// Individual guards
// ---------------------------------------------------------------------------

describe("assertDepartmentInCompany", () => {
  it("resolves when the department belongs to the company", async () => {
    mockDeptFindFirst.mockResolvedValueOnce({ id: "dept-1" });
    await expect(assertDepartmentInCompany("dept-1", COMPANY)).resolves.toBeUndefined();
  });

  it("scopes the lookup by BOTH id and companyId", async () => {
    mockDeptFindFirst.mockResolvedValueOnce({ id: "dept-1" });
    await assertDepartmentInCompany("dept-1", COMPANY);
    expect(mockDeptFindFirst).toHaveBeenCalledWith({
      where: { id: "dept-1", companyId: COMPANY },
      select: { id: true },
    });
  });

  it("throws ApiError(400, department_not_found) for a cross-tenant id", async () => {
    mockDeptFindFirst.mockResolvedValueOnce(null); // not found in this company
    await expect(assertDepartmentInCompany("dept-from-B", COMPANY)).rejects.toMatchObject({
      status: 400,
      code: "department_not_found",
    });
    await expect(assertDepartmentInCompany("dept-from-B", COMPANY)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("assertApiKeyInCompany", () => {
  it("resolves when the api key belongs to the company", async () => {
    mockApiKeyFindFirst.mockResolvedValueOnce({ id: "key-1" });
    await expect(assertApiKeyInCompany("key-1", COMPANY)).resolves.toBeUndefined();
    expect(mockApiKeyFindFirst).toHaveBeenCalledWith({
      where: { id: "key-1", companyId: COMPANY },
      select: { id: true },
    });
  });

  it("throws ApiError(400, api_key_not_found) for a cross-tenant id", async () => {
    mockApiKeyFindFirst.mockResolvedValueOnce(null);
    await expect(assertApiKeyInCompany("key-from-B", COMPANY)).rejects.toMatchObject({
      status: 400,
      code: "api_key_not_found",
    });
  });
});

describe("assertManagerInCompany", () => {
  it("resolves when the manager is a member of the company", async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: "user-1" });
    await expect(assertManagerInCompany("user-1", COMPANY)).resolves.toBeUndefined();
    expect(mockUserFindFirst).toHaveBeenCalledWith({
      where: { id: "user-1", companyId: COMPANY },
      select: { id: true },
    });
  });

  it("throws ApiError(400, managed_by_not_in_company) for a cross-tenant user", async () => {
    mockUserFindFirst.mockResolvedValueOnce(null);
    await expect(assertManagerInCompany("victim-user-in-B", COMPANY)).rejects.toMatchObject({
      status: 400,
      code: "managed_by_not_in_company",
    });
  });
});

// ---------------------------------------------------------------------------
// Combined agent-ref guard
// ---------------------------------------------------------------------------

describe("assertAgentRefsInCompany", () => {
  it("performs NO db lookups when no FKs are supplied", async () => {
    await expect(assertAgentRefsInCompany({}, COMPANY)).resolves.toBeUndefined();
    expect(mockDeptFindFirst).not.toHaveBeenCalled();
    expect(mockApiKeyFindFirst).not.toHaveBeenCalled();
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });

  it("treats explicit null (unset) as a no-op and skips validation", async () => {
    // null means 'clear this relation' on PATCH - it must be allowed without a lookup.
    await expect(
      assertAgentRefsInCompany({ departmentId: null, apiKeyId: null, managedBy: null }, COMPANY),
    ).resolves.toBeUndefined();
    expect(mockDeptFindFirst).not.toHaveBeenCalled();
    expect(mockApiKeyFindFirst).not.toHaveBeenCalled();
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });

  it("validates only the truthy fields that were provided", async () => {
    mockDeptFindFirst.mockResolvedValueOnce({ id: "dept-1" });
    await assertAgentRefsInCompany({ departmentId: "dept-1" }, COMPANY);
    expect(mockDeptFindFirst).toHaveBeenCalledTimes(1);
    expect(mockApiKeyFindFirst).not.toHaveBeenCalled();
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });

  it("validates all three FKs when all are provided", async () => {
    mockDeptFindFirst.mockResolvedValueOnce({ id: "dept-1" });
    mockApiKeyFindFirst.mockResolvedValueOnce({ id: "key-1" });
    mockUserFindFirst.mockResolvedValueOnce({ id: "user-1" });
    await expect(
      assertAgentRefsInCompany(
        { departmentId: "dept-1", apiKeyId: "key-1", managedBy: "user-1" },
        COMPANY,
      ),
    ).resolves.toBeUndefined();
    expect(mockDeptFindFirst).toHaveBeenCalledTimes(1);
    expect(mockApiKeyFindFirst).toHaveBeenCalledTimes(1);
    expect(mockUserFindFirst).toHaveBeenCalledTimes(1);
  });

  it("rejects when the apiKey belongs to another tenant", async () => {
    mockDeptFindFirst.mockResolvedValueOnce({ id: "dept-1" });   // ok
    mockApiKeyFindFirst.mockResolvedValueOnce(null);             // cross-tenant
    await expect(
      assertAgentRefsInCompany({ departmentId: "dept-1", apiKeyId: "key-from-B" }, COMPANY),
    ).rejects.toMatchObject({ status: 400, code: "api_key_not_found" });
  });

  it("rejects a cross-tenant manager (the PII-leak vector)", async () => {
    mockUserFindFirst.mockResolvedValueOnce(null);
    await expect(
      assertAgentRefsInCompany({ managedBy: "victim-in-B" }, OTHER === COMPANY ? OTHER : COMPANY),
    ).rejects.toMatchObject({ status: 400, code: "managed_by_not_in_company" });
  });
});
