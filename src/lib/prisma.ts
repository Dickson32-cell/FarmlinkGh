import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// FarmLink runs on PostgreSQL (Neon) via DATABASE_URL from the environment.
// Never hardcode a file: URL here — local dev uses a Postgres URL from .env
// and Vercel injects DATABASE_URL at runtime.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  });

globalForPrisma.prisma = prisma;