import { randomUUID } from "node:crypto";
import { lookupVirtualKey, type VirtualKeyLookup } from "@/lib/proxy/virtual-keys";

export type AgentContext = VirtualKeyLookup & {
  requestId: string;
  timestamp: Date;
};

export async function identifyAgent(
  authorizationHeader: string | null,
): Promise<AgentContext | null> {
  if (!authorizationHeader) return null;

  const virtualKey = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice(7)
    : authorizationHeader;

  const lookup = await lookupVirtualKey(virtualKey);
  if (!lookup) return null;

  return {
    ...lookup,
    requestId: randomUUID(),
    timestamp: new Date(),
  };
}
