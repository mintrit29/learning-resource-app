import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  serverExternalPackages: ["@napi-rs/canvas", "docling.rs", "pdfjs-dist", "tesseract.js"],
  outputFileTracingIncludes: {
    "/api/pdf-worker": ["./node_modules/pdfjs-dist/build/pdf.worker.min.mjs"],
  },
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
