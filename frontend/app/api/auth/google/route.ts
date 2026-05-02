import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  createAuthCookieValue,
  type Role,
} from "@/lib/auth-cookie";
import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";
import { toAppRole } from "@/lib/users";

export const runtime = "nodejs";

interface GoogleAuthBody {
  credential?: string;
  intent?: "login" | "signup";
  role?: Role;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as GoogleAuthBody | null;
  if (!body?.credential || (body.intent !== "login" && body.intent !== "signup")) {
    return NextResponse.json({ error: "Invalid Google auth request." }, { status: 400 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${getServerApiBase(request)}/api/users/google-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credential: body.credential,
        intent: body.intent,
        role: body.role === "Teacher" ? "generator" : body.role === "QA" ? "auditor" : undefined,
      }),
    });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }

  const payload = (await backendResponse.json().catch(() => null)) as
    | {
        error?: string;
        id?: string;
        email?: string;
        full_name?: string;
        role?: string;
      }
    | null;

  if (!backendResponse.ok || !payload?.id || !payload.email || !payload.full_name || !payload.role) {
    return NextResponse.json(
      { error: payload?.error || "Google sign-in failed." },
      { status: backendResponse.status || 500 },
    );
  }

  let role: Role;
  try {
    role = toAppRole(payload.role);
  } catch {
    return NextResponse.json({ error: "Backend returned an unknown role." }, { status: 500 });
  }

  let token: string;
  try {
    token = await createAuthCookieValue({
      userId: payload.id,
      email: payload.email,
      fullName: payload.full_name,
      role,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Auth cookie secret is not configured." },
      { status: 500 },
    );
  }

  const response = NextResponse.json(
    {
      status: "ok",
      role,
      userId: payload.id,
      expires_in: AUTH_COOKIE_MAX_AGE_SECONDS,
    },
    { status: 200 },
  );
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
