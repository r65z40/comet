import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public endpoint - no auth required (used on login page)
export async function GET() {
  const siteLogo = await prisma.setting.findUnique({ where: { key: "site_logo" } });

  return NextResponse.json({
    site_logo: siteLogo?.value || "",
  });
}
