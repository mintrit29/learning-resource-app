import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  serverExternalPackages: ["docling.rs"],
  outputFileTracingExcludes: {
    "*": [
      "./.docling-runtime/**/*",
      "./dist-electron/**/*",
      "./models-cache/**/*",
      "./storage/**/*",
    ],
  },
};

export default nextConfig;
