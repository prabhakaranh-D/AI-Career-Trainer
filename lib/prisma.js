import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // Increase connection timeout for Neon cold starts
    datasourceUrl: process.env.DATABASE_URL,
  }).$extends({
    query: {
      async $allOperations({ operation, model, args, query }) {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 2000; // 2 seconds

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            // P1001 = Can't reach database server
            // P1002 = Database server timed out
            // P2024 = Timed out fetching a new connection from pool
            const isRetryable =
              error?.code === "P1001" ||
              error?.code === "P1002" ||
              error?.code === "P2024" ||
              error?.message?.includes("Can't reach database server") ||
              error?.message?.includes("Connection timed out");

            if (isRetryable && attempt < MAX_RETRIES) {
              console.warn(
                `Database connection failed (attempt ${attempt}/${MAX_RETRIES}). ` +
                `Retrying in ${RETRY_DELAY / 1000}s... [${model}.${operation}]`
              );
              await new Promise((r) => setTimeout(r, RETRY_DELAY * attempt));
              continue;
            }

            throw error;
          }
        }
      },
    },
  });
};

// globalThis.prisma: Ensures the Prisma client instance is reused across
// hot reloads during development. Without this, each reload creates a new
// instance, potentially exhausting database connections.
export const db = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = db;
}
