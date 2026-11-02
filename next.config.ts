import type { NextConfig } from "next";

// `cloudflare:workers` exists only in the Cloudflare Workers runtime, but
// db/index.ts imports it, which breaks standard Next.js builds (for
// example on Vercel) at page-data collection time. Point the import at a
// local shim for Next.js builds only: the shim provides no bindings, so
// getDb() reports D1 as unavailable and account features stay disabled
// instead of failing the whole build. This config is not read by the
// Workers (vinext) build, so the hosted ChatGPT Site is unaffected.
const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "cloudflare:workers": "./lib/cloudflare-workers-shim.ts",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "cloudflare:workers": "./lib/cloudflare-workers-shim.ts",
    };
    return config;
  },
};

export default nextConfig;
