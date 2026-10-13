import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["pg"],
  outputFileTracingRoot: import.meta.dirname,
  // The quotation PDF reads its fonts from disk, so ship them with that route.
  outputFileTracingIncludes: {
    "/api/quotes/\\[id\\]/pdf": ["./assets/fonts/**/*"],
  },
};

export default config;
