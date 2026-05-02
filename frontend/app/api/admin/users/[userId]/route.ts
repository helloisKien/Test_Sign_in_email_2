import { NextResponse } from "next/server";

import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;

  try {
    const response = await fetch(`${getServerApiBase(request)}/api/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { error: "Unable to delete user." }, { status: response.status });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }
}
