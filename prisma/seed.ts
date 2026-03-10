import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: { email: "admin@comet-cedelia.fr" },
    update: {},
    create: {
      name: "Administrateur",
      email: "admin@comet-cedelia.fr",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  await prisma.setting.upsert({
    where: { key: "axonaut_api_url" },
    update: {},
    create: { key: "axonaut_api_url", value: "https://axonaut.com/api/v2" },
  });

  console.log("Seed completed successfully");
  console.log("Admin account: admin@comet-cedelia.fr / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
