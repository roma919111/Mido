import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/player", destination: "/maxmediaplayer", permanent: false },
      { source: "/player/:path*", destination: "/maxmediaplayer", permanent: false },
      { source: "/vyronixmaxmediaplayer", destination: "/maxmediaplayer", permanent: true },
      { source: "/vyronixmaxmediaplayer/:path*", destination: "/maxmediaplayer", permanent: true },
      { source: "/maxvyronixmerdia", destination: "/max", permanent: true },
      { source: "/maxvyronixmerdia/:path*", destination: "/max", permanent: true },
      { source: "/maxvyronixmedia", destination: "/max", permanent: true },
      { source: "/maxvyronixmedia/:path*", destination: "/max", permanent: true },
      { source: "/maxvronixmedia", destination: "/max", permanent: true },
      { source: "/maxvronixmedia/:path*", destination: "/max", permanent: true },
      { source: "/admin/iptv", destination: "/admin?tab=player", permanent: false },
      { source: "/admin/iptv/:path*", destination: "/admin?tab=player", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/promo/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/favicon-48.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
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
