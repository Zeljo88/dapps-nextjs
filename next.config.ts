import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: "http://20.79.10.28",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "icons.llama.fi" },
      { protocol: "https", hostname: "asset-logos.minswap.org" },
      { protocol: "https", hostname: "app.minswap.org" },
    ],
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
      {
        // Cache static assets aggressively
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Cache images
        source: "/_next/image(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
};

export default nextConfig;
