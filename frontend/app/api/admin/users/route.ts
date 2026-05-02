import { NextResponse } from "next/server";

import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const response = await fetch(`${getServerApiBase(request)}/api/users`, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { error: "Unable to read users." }, { status: response.status });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }
}
