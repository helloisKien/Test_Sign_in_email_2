import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthCookieValue } from "@/lib/auth-cookie";
import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  const auth = await verifyAuthCookieValue(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (auth.role !== "Admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { requestId } = await context.params;
  const normalized = (requestId || "").trim();
  if (!normalized) {
    return NextResponse.json({ error: "Request id is required." }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${getServerApiBase(request)}/api/review/submissions/${encodeURIComponent(normalized)}`,
      {
        method: "DELETE",
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      },
    );
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { error: "Unable to delete session." }, { status: response.status });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }
}
