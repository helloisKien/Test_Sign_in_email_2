import { NextResponse } from "next/server";

import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();

  try {
    const response = await fetch(`${getServerApiBase(request)}/api/admin/reprocess/abet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      body,
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { error: "Unable to start ABET reprocessing." }, { status: response.status });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }
}

