import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  // Generate a random password for the admin account
  const defaultPassword = crypto.randomBytes(12).toString("base64url");
  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  const user = await prisma.user.upsert({
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
  console.log(`Admin account: admin@comet-cedelia.fr`);
  // Only show password if the user was just created (not already existing)
  if (user.createdAt.getTime() > Date.now() - 5000) {
    console.log(`Generated password: ${defaultPassword}`);
    console.log("IMPORTANT: Change this password immediately after first login!");
  } else {
    console.log("Admin user already exists, password unchanged.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
