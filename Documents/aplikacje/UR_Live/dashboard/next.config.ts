import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables standalone output for Docker production builds.
  // This drastically reduces the Docker image size by bundling only
  // the necessary files, without requiring a full node_modules copy.
  output: "standalone",
};

export default nextConfig;
