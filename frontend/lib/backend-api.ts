const DEFAULT_LOCAL_BACKEND_ORIGIN = "http://127.0.0.1:8000";

export const BACKEND_ROUTE_PREFIX = "/backend-api";

function normalizeBase(value: string | undefined | null): string | null {
  const normalized = (value || "").trim().replace(/\/$/, "");
  return normalized || null;
}

export function getPublicApiBase(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_PRODUCT_API_URL,
    process.env.NEXT_PUBLIC_GENERATOR_API_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBase(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return BACKEND_ROUTE_PREFIX;
}

export function getServerApiBase(request: Request): string {
  const candidates = [
    process.env.PRODUCT_API_INTERNAL_URL,
    process.env.API_URL,
    process.env.NEXT_PUBLIC_PRODUCT_API_URL,
    process.env.NEXT_PUBLIC_GENERATOR_API_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBase(candidate);
    if (normalized) {
      return normalized;
    }
  }

  if (process.env.VERCEL) {
    return new URL(BACKEND_ROUTE_PREFIX, request.url).toString().replace(/\/$/, "");
  }

  return getLocalBackendOrigin();
}

export function getLocalBackendOrigin(): string {
  return (
    normalizeBase(process.env.PRODUCT_API_LOCAL_URL) ||
    normalizeBase(process.env.NEXT_PUBLIC_PRODUCT_API_LOCAL_URL) ||
    DEFAULT_LOCAL_BACKEND_ORIGIN
  );
}

export function getBackendConnectionErrorMessage(): string {
  return "Authentication service is unavailable. Make sure the backend is running and the API URL env vars are correct.";
}
