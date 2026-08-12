import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  serverExternalPackages: ["docling.rs"],
  outputFileTracingExcludes: {
    "*": ["./dist-electron/**/*", "./storage/**/*"],
  },
};

export default nextConfig;
