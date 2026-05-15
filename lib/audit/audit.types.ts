/**
 * @module audit.types
 * @description Canonical type definitions for the Synthforce Audit Service.
 *
 * ARCHITECTURAL CONTRACT:
 * - AuditEventPayload is the ONLY serialization surface for hash computation.
 * - All fields must be deterministically ordered (enforced at runtime by canonicalize()).
 * - The `prev_hash` field creates the chain. Genesis events use GENESIS_SENTINEL.
 * - Never add optional fields to AuditEventPayload without a migration + rehash strategy.
 */

// ─── Sentinel ────────────────────────────────────────────────────────────────

export const GENESIS_SENTINEL = "0000000000000000000000000000000000000000000000000000000000000000" as const;

// ─── Actor Union ─────────────────────────────────────────────────────────────

export type ActorType = "AGENT" | "HUMAN_OPERATOR" | "EXTERNAL_SYSTEM" | "PLATFORM";

export interface AgentActor {
  type: "AGENT";
  agent_id: string;
  agent_version: string;
  tenant_id: string;
}

export interface HumanOperatorActor {
  type: "HUMAN_OPERATOR";
  user_id: string;
  tenant_id: string;
  session_id: string;
}

export interface ExternalSystemActor {
  type: "EXTERNAL_SYSTEM";
  system_id: string;        // e.g. "langchain", "autogen", "zapier"
  integration_id: string;   // tenant-scoped integration record ID
  tenant_id: string;
}

export interface PlatformActor {
  type: "PLATFORM";
  service: string;          // e.g. "policy-engine", "autoscaler", "config-manager"
  instance_id: string;
}

export type Actor =
  | AgentActor
  | HumanOperatorActor
  | ExternalSystemActor
  | PlatformActor;

// ─── Event Categories ─────────────────────────────────────────────────────────

export type EventCategory =
  | "AGENT_LIFECYCLE"        // onboard, suspend, terminate, promote
  | "DECISION_TRACE"         // agent reasoning/tool call trace
  | "POLICY_ENFORCEMENT"     // policy eval + outcome
  | "DATA_ACCESS"            // what data was read/written
  | "CONFIGURATION_CHANGE"   // system config mutations
  | "AUTH_EVENT"             // login, token issue, revoke
  | "INTEGRATION_EVENT"      // external system webhook in/out
  | "COMPLIANCE_REPORT";     // generated compliance artifacts

export type EventOutcome = "SUCCESS" | "FAILURE" | "PARTIAL" | "PENDING";

// ─── Core Payload (Serialization Surface) ────────────────────────────────────
//
// WARNING: Field ORDER here is irrelevant — canonicalize() sorts keys.
// WARNING: All values must be JSON-serializable primitives or plain objects.
// Never put class instances, Dates (use ISO strings), or undefined values here.

export interface AuditEventPayload {
  readonly category: EventCategory;
  readonly event_type: string;          // e.g. "AGENT_LIFECYCLE.ONBOARD"
  readonly actor: Actor;
  readonly outcome: EventOutcome;
  readonly resource_type: string;       // what entity was acted upon
  readonly resource_id: string;
  readonly tenant_id: string;
  readonly timestamp_utc: string;       // ISO 8601, always UTC, e.g. "2025-01-15T10:30:00.000Z"
  readonly metadata: Record<string, unknown>; // domain-specific, must be JSON-serializable
  readonly schema_version: string;      // semver — e.g. "1.0.0"
}

// ─── Stored Record (DB + S3) ──────────────────────────────────────────────────

export interface AuditRecord {
  readonly id: string;                  // UUIDv7 — time-ordered for index performance
  readonly tenant_id: string;           // denormalized for RLS policy
  readonly prev_hash: string;           // SHA-256 hex of previous record | GENESIS_SENTINEL
  readonly current_hash: string;        // HMAC-SHA256 of canonicalized payload
  readonly payload: AuditEventPayload;
  readonly s3_key: string;              // where this record lives in WORM storage
  readonly created_at: string;          // ISO 8601 UTC — set by service, not client
}

// ─── Hash Chain Verification ──────────────────────────────────────────────────

export interface ChainVerificationResult {
  readonly valid: boolean;
  readonly checked_count: number;
  readonly first_invalid_id: string | null;
  readonly first_invalid_position: number | null;
  readonly computed_hashes: Map<string, string>; // id → recomputed hash
}

// ─── Service Config ───────────────────────────────────────────────────────────

export interface AuditServiceConfig {
  readonly hmac_secret: string;         // loaded from secrets manager, never from env directly
  readonly s3_bucket: string;
  readonly s3_prefix: string;           // e.g. "audit-logs/v1"
  readonly s3_region: string;
  readonly db_connection_string: string;
  readonly schema_version: string;      // must match AuditEventPayload.schema_version
}
