import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@yaya/ui", "@yaya/tokens", "@yaya/config"],
};

export default nextConfig;
