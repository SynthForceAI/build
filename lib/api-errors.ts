/**
 * Uniform error responses for API route handlers.
 *
 * Usage:
 *
 *     export async function GET() {
 *       try {
 *         const { user } = await requireUser();
 *         ...
 *       } catch (e) {
 *         return handleApiError(e);
 *       }
 *     }
 *
 * Always returns JSON with shape: `{ error: { code, message, detail? } }`.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly extra: { detail?: string; fields?: Record<string, string[]> } = {},
  ) {
    super(`${code}${extra.detail ? `: ${extra.detail}` : ""}`);
    this.name = "ApiError";
  }
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, ...err.extra } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code:    "validation_failed",
          message: "Request body failed validation.",
          fields:  err.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: { code: "unique_violation", message: "Resource already exists.", meta: err.meta } },
        { status: 409 },
      );
    }
    if (err.code === "P2025") {
      return NextResponse.json(
        { error: { code: "not_found", message: "Resource not found." } },
        { status: 404 },
      );
    }
  }
  // eslint-disable-next-line no-console
  console.error("[api] unhandled error:", err);
  return NextResponse.json(
    { error: { code: "internal_error", message: "An unexpected error occurred." } },
    { status: 500 },
  );
}
