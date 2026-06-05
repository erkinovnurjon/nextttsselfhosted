import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Docker uchun mustaqil build
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
