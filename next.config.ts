import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: "http://20.79.10.28",
  },
  async redirects() {
    return [
      { source: "/analytics/globalstats", destination: "/ecosystem", permanent: true },
      { source: "/releases/:path*",        destination: "/",          permanent: true },
      { source: "/crafted/:path*",         destination: "/",          permanent: true },
      { source: "/apps/:path*",            destination: "/",          permanent: true },
      { source: "/builder",               destination: "/",          permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-src 'self' https://swap.dexhunter.io;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
