import { NextResponse } from "next/server";

import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";

export const runtime = "nodejs";

type ResetPasswordBody = {
  token?: string;
  newPassword?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ResetPasswordBody | null;
  const token = (body?.token || "").trim();
  const newPassword = body?.newPassword || "";

  if (!token || !newPassword) {
    return NextResponse.json({ error: "Token and new password are required." }, { status: 400 });
  }

  try {
    const response = await fetch(`${getServerApiBase(request)}/api/users/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        new_password: newPassword,
      }),
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { status: "ok" }, { status: response.status });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }
}
