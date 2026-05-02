import { NextResponse } from "next/server";

import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";

export const runtime = "nodejs";

type ForgotPasswordBody = {
  email?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ForgotPasswordBody | null;
  const email = (body?.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    const response = await fetch(`${getServerApiBase(request)}/api/users/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-url": request.headers.get("origin") || new URL(request.url).origin,
      },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { status: "ok" }, { status: response.status });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }
}
