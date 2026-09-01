import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Production seed: ONLY the admin account. No demo farmers/buyers/listings/prices —
// this is a live production site; real users register through the site itself.
// The password below is a dev bootstrap; change it after first login, or run
// this only on fresh databases.
async function main() {
  console.log("Seeding FarmLink Ghana (admin only)...");

  const adminPass = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { phone: "0248847819" },
    update: {},
    create: {
      name: "FarmLink Admin",
      phone: "0248847819",
      password: adminPass,
      role: "admin",
      status: "approved",
    },
  });

  console.log("Admin ready:", admin.phone, "(login: phone + password → email code to ADMIN_EMAIL)");
  console.log("Seed complete. No demo data in production.");
}

main().catch(console.error).finally(() => prisma.$disconnect());