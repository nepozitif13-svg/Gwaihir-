import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Persistence is for history only — never let a DB failure block a response.
export async function saveRunSafe(args: {
  mode: "A" | "B";
  input: string;
  config: unknown;
  results: unknown;
}): Promise<void> {
  try {
    await prisma.run.create({
      data: {
        mode: args.mode,
        input: args.input,
        config: JSON.stringify(args.config ?? {}),
        results: JSON.stringify(args.results ?? {}),
      },
    });
  } catch (err) {
    console.error("[gwaihir] saveRunSafe failed (non-fatal):", err);
  }
}
