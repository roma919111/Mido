import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow temporary public tunnels during development (phone testing).
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "vyronix-ai.loca.lt",
    "*.loca.lt",
    "loca.lt",
    "*.trycloudflare.com",
    "trycloudflare.com",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
