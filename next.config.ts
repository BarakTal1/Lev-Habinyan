import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phone photos are 2-5 MB. The default server action body limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
