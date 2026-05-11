import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

function loadRootEnvFile(fileName: string): void {
  const rootPath = path.resolve(process.cwd(), "..", "..", fileName);
  if (!fs.existsSync(rootPath)) {
    return;
  }

  const raw = fs.readFileSync(rootPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadRootEnvFile(".env.local");
loadRootEnvFile(".env");

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
