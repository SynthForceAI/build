import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto";
import { ApiError } from "@/lib/api-errors";

export type VirtualKeyLookup = {
  agentId: string;
  companyId: string;
  providerId: string;
  providerName: string;
  providerApiBaseUrl: string;
  providerApiKey: string;
};

export async function generateVirtualKey(
  agentId: string,
  providerId: string,
  providerApiKey: string,
): Promise<string> {
  const virtualKey = `sf-key-${randomBytes(16).toString("hex")}`;
  const encrypted = encryptApiKey(providerApiKey);

  await prisma.agentVirtualKey.create({
    data: {
      agentId,
      providerId,
      virtualKey,
      encryptedProviderKey: encrypted,
      isActive: true,
    },
  });

  return virtualKey;
}

export async function lookupVirtualKey(virtualKey: string): Promise<VirtualKeyLookup | null> {
  if (!virtualKey.startsWith("sf-key-")) return null;

  const record = await prisma.agentVirtualKey.findUnique({
    where: { virtualKey },
    include: {
      provider: true,
      agent: { select: { companyId: true } },
    },
  });

  if (!record || !record.isActive) return null;

  // Touch lastUsedAt without blocking the request
  prisma.agentVirtualKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => null);

  return {
    agentId:           record.agentId,
    companyId:         record.agent.companyId,
    providerId:        record.providerId,
    providerName:      record.provider.name,
    providerApiBaseUrl: record.provider.apiBaseUrl ?? "",
    providerApiKey:    decryptApiKey(record.encryptedProviderKey),
  };
}

export async function rotateVirtualKey(oldVirtualKey: string): Promise<string> {
  const record = await prisma.agentVirtualKey.findUnique({
    where: { virtualKey: oldVirtualKey },
  });

  if (!record) throw new ApiError(404, "not_found", { detail: "Virtual key not found." });

  const newKey = await generateVirtualKey(
    record.agentId,
    record.providerId,
    decryptApiKey(record.encryptedProviderKey),
  );

  await prisma.agentVirtualKey.update({
    where: { id: record.id },
    data: { isActive: false, rotatedAt: new Date() },
  });

  return newKey;
}

export async function revokeVirtualKey(virtualKey: string): Promise<void> {
  await prisma.agentVirtualKey.updateMany({
    where: { virtualKey },
    data: { isActive: false },
  });
}
