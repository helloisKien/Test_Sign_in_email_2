import { NextResponse } from "next/server";

import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const response = await fetch(`${getServerApiBase(request)}/api/users/me/avatar`, {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
      body: formData,
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { error: "Unable to upload avatar." }, { status: response.status });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }
}
