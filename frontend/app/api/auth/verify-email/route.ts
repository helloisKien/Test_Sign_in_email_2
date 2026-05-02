import { NextResponse } from "next/server";

import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const token = (body?.token || "").trim();
  if (!token) {
    return NextResponse.json({ error: "Verification token is required." }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${getServerApiBase(request)}/api/users/verify-email?token=${encodeURIComponent(token)}`,
      { method: "GET" },
    );
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { status: "ok" }, { status: response.status });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }
}
