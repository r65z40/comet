import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public endpoint - no auth required (used on login page, sidebar, favicon)
export async function GET() {
  const [siteLogo, siteFavicon] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "site_logo" } }),
    prisma.setting.findUnique({ where: { key: "site_favicon" } }),
  ]);

  return NextResponse.json({
    site_logo: siteLogo?.value || "",
    site_favicon: siteFavicon?.value || "",
  });
}
