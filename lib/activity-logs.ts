import { prisma } from "./db";

export type ActivityAction = "signup" | "login" | "logout";

export async function logActivity(
  userId: string,
  action: ActivityAction,
  metadata?: Record<string, any>
) {
  try {
    return await prisma.activityLog.create({
      data: {
        userId,
        action,
        metadata: metadata || {},
      },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Don't throw - activity logging shouldn't break auth flow
  }
}

export async function getUserActivityLogs(userId: string, limit = 50) {
  return await prisma.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getAllActivityLogs(limit = 100, offset = 0) {
  const logs = await prisma.activityLog.findMany({
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  const total = await prisma.activityLog.count();

  return { logs, total };
}
