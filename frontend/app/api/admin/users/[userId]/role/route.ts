import { NextResponse } from "next/server";

import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  const body = await request.text();

  try {
    const response = await fetch(`${getServerApiBase(request)}/api/users/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      body,
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { error: "Unable to update role." }, { status: response.status });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }
}
