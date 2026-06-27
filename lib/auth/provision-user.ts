import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";

type ProvisionInput = {
  id: string;
  email: string;
};

/**
 * Create the SynthForce company + users rows for a newly verified Supabase user.
 * Idempotent: safe to call again after email confirmation or on login.
 */
export async function provisionNewUser({ id, email }: ProvisionInput): Promise<User> {
  let company = await prisma.company.findFirst({
    where: {
      users: {
        some: { id },
      },
    },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: `${email}'s Workspace`,
        slug: `workspace-${id.substring(0, 8)}`,
      },
    });
  }

  return prisma.user.upsert({
    where: { id },
    create: {
      id,
      email,
      name: email.split("@")[0],
      companyId: company.id,
      role: "owner",
    },
    update: {
      email,
    },
  });
}
