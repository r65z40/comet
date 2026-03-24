import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@aws-sdk/client-s3", "basic-ftp"],
};

export default nextConfig;
