/**
 * Zod schemas for every public API request body.
 *
 * Conventions:
 * - Use `*CreateSchema` for POSTs (require all required fields).
 * - Use `*UpdateSchema` for PATCHes (all fields optional, but at least
 *   one must be provided; enforced via `.refine`).
 * - Always strip unknown keys via `.strict()` — defends against
 *   prototype-pollution-style misuse and accidental field updates.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const Uuid = z.string().uuid();
export const NonEmptyString = z.string().trim().min(1);

const atLeastOneKey = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).strict().refine(
    (v) => Object.keys(v).length > 0,
    { message: "At least one field must be provided." },
  );

// ---------------------------------------------------------------------------
// Companies (admin / onboarding)
// ---------------------------------------------------------------------------

export const CompanyUpdateSchema = atLeastOneKey({
  name:             NonEmptyString.max(255).optional(),
  slug:             z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be kebab-case lowercase.").optional(),
  subscriptionTier: z.enum(["free", "starter", "team", "enterprise"]).optional(),
  settings:         z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export const DepartmentCreateSchema = z.object({
  name:               NonEmptyString.max(255),
  description:        z.string().max(2000).optional(),
  monthlyBudgetCents: z.number().int().nonnegative().optional(),
}).strict();

export const DepartmentUpdateSchema = atLeastOneKey({
  name:               NonEmptyString.max(255).optional(),
  description:        z.string().max(2000).nullable().optional(),
  monthlyBudgetCents: z.number().int().nonnegative().optional(),
});

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export const AgentStatusEnum = z.enum(["active", "paused", "deactivated", "flagged"]);

export const AgentCreateSchema = z.object({
  name:               NonEmptyString.max(255),
  description:        z.string().max(2000).optional(),
  departmentId:       Uuid.optional(),
  providerId:         Uuid.optional(),
  modelId:            Uuid.optional(),
  apiKeyId:           Uuid.optional(),
  monthlyBudgetCents: z.number().int().nonnegative().optional(),
  logFullContent:     z.boolean().optional(),
  managedBy:          Uuid.optional(),
  metadata:           z.record(z.unknown()).optional(),
}).strict();

export const AgentUpdateSchema = atLeastOneKey({
  name:               NonEmptyString.max(255).optional(),
  description:        z.string().max(2000).nullable().optional(),
  status:             AgentStatusEnum.optional(),
  departmentId:       Uuid.nullable().optional(),
  providerId:         Uuid.nullable().optional(),
  modelId:            Uuid.nullable().optional(),
  apiKeyId:           Uuid.nullable().optional(),
  monthlyBudgetCents: z.number().int().nonnegative().optional(),
  logFullContent:     z.boolean().optional(),
  managedBy:          Uuid.nullable().optional(),
  metadata:           z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export const PolicyRuleSchema = z.discriminatedUnion("type", [
  z.object({
    type:     z.literal("budget"),
    operator: z.enum(["less_than", "less_than_or_equal"]),
    field:    z.enum(["monthly_spend", "lifetime_spend"]),
    valueCents: z.number().int().nonnegative(),
  }),
  z.object({
    type:    z.literal("rate_limit"),
    perMinute: z.number().int().positive().optional(),
    perHour:   z.number().int().positive().optional(),
    perDay:    z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("time_restriction"),
    timezone: z.string(),
    allowedHours: z.array(z.number().int().min(0).max(23)).min(1),
  }),
  z.object({
    type: z.literal("content_guard"),
    blockedTerms:   z.array(NonEmptyString).max(500).optional(),
    blockedPatterns: z.array(NonEmptyString).max(50).optional(),
  }),
  z.object({
    type:           z.literal("model_restriction"),
    allowedModelIds: z.array(Uuid).min(1),
  }),
  z.object({
    type:                 z.literal("department_isolation"),
    allowedDepartmentIds: z.array(Uuid).min(1),
  }),
]).superRefine((data, ctx) => {
  if (data.type === "rate_limit" && !data.perMinute && !data.perHour && !data.perDay) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Specify at least one of perMinute / perHour / perDay.",
    });
  }
  if (
    data.type === "content_guard" &&
    !data.blockedTerms?.length &&
    !data.blockedPatterns?.length
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Specify blockedTerms or blockedPatterns.",
    });
  }
});

export const PolicyCreateSchema = z.object({
  name:              NonEmptyString.max(255),
  description:       z.string().max(2000).optional(),
  ruleDefinition:    PolicyRuleSchema,
  severity:          z.enum(["warning", "block", "flag", "log"]).optional(),
  scope:             z.enum(["global", "department", "agent"]).optional(),
  scopeDepartmentId: Uuid.optional(),
  isActive:          z.boolean().optional(),
}).strict();

export const PolicyUpdateSchema = atLeastOneKey({
  name:              NonEmptyString.max(255).optional(),
  description:       z.string().max(2000).nullable().optional(),
  ruleDefinition:    PolicyRuleSchema.optional(),
  severity:          z.enum(["warning", "block", "flag", "log"]).optional(),
  scope:             z.enum(["global", "department", "agent"]).optional(),
  scopeDepartmentId: Uuid.nullable().optional(),
  isActive:          z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export const ApiKeyCreateSchema = z.object({
  providerId: Uuid,
  label:      NonEmptyString.max(255).optional(),
  // The raw provider API key the customer pasted. Encrypted before storage,
  // never returned, never logged.
  apiKey:     NonEmptyString.max(500),
}).strict();

// ---------------------------------------------------------------------------
// Provider key connection (Onboard page)
// ---------------------------------------------------------------------------

export const ProviderConnectSchema = z.object({
  providerId:   Uuid,
  apiKey:       NonEmptyString.max(500),
  label:        NonEmptyString.max(255).optional(),
  agentName:    NonEmptyString.min(3).max(255),
  departmentId: Uuid.optional(),
}).strict();

// ---------------------------------------------------------------------------
// Audits (free audit wedge)
// ---------------------------------------------------------------------------

export const AuditCreateSchema = z.object({
  // Raw OpenAI API key (will be encrypted before storage)
  apiKey:     NonEmptyString.max(500),
  // How many days back to audit (default 30)
  periodDays: z.number().int().positive().max(90).optional(),
}).strict();
