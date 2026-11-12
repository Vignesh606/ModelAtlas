import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: data is dynamic by default; we opt into caching with
  // "use cache" (e.g. the OpenRouter models list, revalidated hourly).
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // Pin the project root; a stray lockfile in a parent folder otherwise confuses detection.
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
