import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  serverExternalPackages: ["@firecrawl/pdf-inspector", "docling.rs"],
  outputFileTracingExcludes: {
    "*": ["./dist-electron/**/*", "./storage/**/*"],
  },
};

export default nextConfig;
