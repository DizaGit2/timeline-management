import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@timeline.dev",
      passwordHash,
      name: "Dev Admin",
      role: "ADMIN",
      isActive: true,
      organization: {
        create: {
          name: "Dev Organization",
          ownerUserId: "", // placeholder
        },
      },
    },
    include: { organization: true },
  });

  await prisma.organization.update({
    where: { id: admin.organizationId },
    data: { ownerUserId: admin.id },
  });

  console.log(`Created admin user: ${admin.email} (password: admin123)`);
  console.log(`Created organization: ${admin.organization.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
