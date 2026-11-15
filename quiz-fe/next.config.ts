import dotenv from "dotenv";
import type { NextConfig } from "next";

dotenv.config({ path: "../.env" });

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4100"}/:path*` }];
  },
};

export default nextConfig;
