import { NextResponse } from "next/server";

import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;

  try {
    const response = await fetch(`${getServerApiBase(request)}/api/users/${encodeURIComponent(userId)}/reset-password`, {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { error: "Unable to trigger password reset." }, { status: response.status });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }
}

