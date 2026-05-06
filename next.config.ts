import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config) {
    config.watchOptions = {
      ...(config.watchOptions ?? {}),
      ignored: ["**/node_modules/**", "**/.next/**", "**/.npm-cache/**"]
    };

    return config;
  }
};

export default nextConfig;
