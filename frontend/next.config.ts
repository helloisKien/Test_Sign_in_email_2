import type { NextConfig } from "next";

const localBackendOrigin =
  process.env.PRODUCT_API_LOCAL_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_PRODUCT_API_LOCAL_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    workerThreads: true,
    cpus: 1,
  },
  async rewrites() {
    if (process.env.VERCEL) {
      return [];
    }

    return [
      {
        source: "/backend-api/:path*",
        destination: `${localBackendOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
