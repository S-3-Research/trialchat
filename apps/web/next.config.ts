import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel sets `VERCEL_ENV` ("production" | "preview" | "development") on
  // the server automatically, but it isn't inlined into the client bundle
  // by default. Re-exposing it under `NEXT_PUBLIC_` lets guestId.ts's
  // `isTestMode()` tell a *real* production deploy apart from a preview
  // branch deploy client-side too (preview branches also build with
  // `NODE_ENV=production`, so that alone isn't enough to distinguish them
  // — see the doc comment on `isTestMode()`).
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
    };
    return config;
  },
};

export default nextConfig;
