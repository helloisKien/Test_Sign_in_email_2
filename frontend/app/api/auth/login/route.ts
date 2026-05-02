import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  createAuthCookieValue,
} from "@/lib/auth-cookie";
import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";
import { AuthApiError, verifyCredentials } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;

  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  let user;
  try {
    user = await verifyCredentials(body.email, body.password, getServerApiBase(request));
  } catch (error) {
    if (error instanceof AuthApiError) {
      return NextResponse.json(
        { error: error.message || "Authentication request failed." },
        { status: error.status >= 400 && error.status <= 599 ? error.status : 502 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Unable to reach the authentication service.";
    return NextResponse.json(
      { error: message },
      { status: message === getBackendConnectionErrorMessage() ? 503 : 502 },
    );
  }
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  let token: string;
  try {
    token = await createAuthCookieValue({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
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
      userId: user.id,
      role: user.role,
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
