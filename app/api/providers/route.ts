/**
 * GET /api/providers — list seeded providers + their models.
 * Read-only reference data. No role restriction beyond authentication.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { decimalToJson } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const providers = await prisma.provider.findMany({
      where:   { isActive: true },
      orderBy: { displayName: "asc" },
      include: { models: { where: { isActive: true }, orderBy: { displayName: "asc" } } },
    });
    return NextResponse.json({
      providers: providers.map((p) => ({
        ...p,
        models: p.models.map((m) => ({
          ...m,
          inputPricePerToken:  decimalToJson(m.inputPricePerToken),
          outputPricePerToken: decimalToJson(m.outputPricePerToken),
        })),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
