import { PrismaClient } from "@prisma/client";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// FarmLink runs on SQLite (schema.prisma → file:./dev.db).
// DATABASE_URL in .env may hold a Postgres URL from a copied template — IGNORE it for now.
// When we migrate to Render+Neon, switch schema.prisma to postgresql and use DATABASE_URL.
function buildDatabaseUrl(): string {
  return "file:" + path.join(process.cwd(), "prisma", "dev.db.bak1") + "?connection_limit=1&busy_timeout=5000&socket_timeout=10";
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: buildDatabaseUrl() },
    },
  });

globalForPrisma.prisma = prisma;