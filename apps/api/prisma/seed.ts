import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/security.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const phone = "+79990000000";
  const existing = await prisma.user.findUnique({ where: { phone } });

  if (!existing) {
    await prisma.user.create({
      data: {
        phone,
        displayName: "Owner",
        locale: "ru",
        isAdmin: true,
        cloudPasswordHash: await hashPassword("ChangeMe12345")
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
