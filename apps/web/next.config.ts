import type { NextConfig } from "next";

const ocrFiles = ["./ocr-data/**", "../../node_modules/.pnpm/tesseract.js@*/node_modules/tesseract.js/**", "../../node_modules/.pnpm/tesseract.js-core@*/node_modules/tesseract.js-core/**", "../../node_modules/.pnpm/node_modules/tesseract.js*/**"];

const config: NextConfig = {
  transpilePackages: ["@grantly/core", "@grantly/pipeline"],
  serverExternalPackages: ["tesseract.js", "tesseract.js-core", "jsdom"],
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  outputFileTracingIncludes: {
    "/api/documents/*/process": ocrFiles,
    "/api/setup-check": ocrFiles,
  },
};

export default config;
