import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  outputFileTracingExcludes: {
    "*": ["./dist-electron/**/*", "./storage/**/*"],
  },
};

export default nextConfig;
