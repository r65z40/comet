import type { NextConfig } from "next";
import { execSync } from "child_process";

let gitHash = "";
try {
  gitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch {}

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@aws-sdk/client-s3", "basic-ftp"],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || "1.5.0",
    NEXT_PUBLIC_GIT_HASH: gitHash,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
