import { NextResponse } from "next/server";

import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const response = await fetch(`${getServerApiBase(request)}/api/updates`, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { items: [] }, { status: response.status });
  } catch {
    return NextResponse.json({ items: [], error: getBackendConnectionErrorMessage() }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  try {
    const response = await fetch(`${getServerApiBase(request)}/api/updates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      body,
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { error: "Unable to publish update." }, { status: response.status });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }
}
