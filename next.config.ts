import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.0.130", "*.local"],
};

export default nextConfig;
