import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  createAuthCookieValue,
  normalizeRole,
} from "@/lib/auth-cookie";
import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";
import { toAppRole } from "@/lib/users";

export const runtime = "nodejs";

interface SignupBody {
  email?: string;
  fullName?: string;
  password?: string;
  confirmPassword?: string;
  role?: string;
}

type BackendSignupPayload =
  | {
      status: "pending_verification";
      email?: string;
      message?: string;
      verification_email_sent?: boolean;
    }
  | {
      id?: string;
      email?: string;
      full_name?: string;
      role?: string;
      error?: string;
      detail?: Array<{ msg?: string }>;
    };

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least 1 uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least 1 digit.";
  return null;
}

function extractApiErrorMessage(payload: BackendSignupPayload | null, fallback: string): string {
  if (!payload) return fallback;
  if ("error" in payload && typeof payload.error === "string" && payload.error) return payload.error;
  if ("detail" in payload && Array.isArray(payload.detail) && payload.detail[0] && typeof payload.detail[0].msg === "string") {
    return payload.detail[0].msg;
  }
  return fallback;
}

function toBackendRole(role: "Teacher" | "QA" | "Admin"): "generator" | "auditor" | "admin" {
  if (role === "Teacher") return "generator";
  if (role === "QA") return "auditor";
  return "admin";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SignupBody | null;

  if (!body?.email || !body?.fullName || !body?.password || !body?.confirmPassword || !body?.role) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  if (!validateEmail(body.email)) {
    return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
  }

  if (body.fullName.trim().length < 2 || body.fullName.trim().length > 100) {
    return NextResponse.json({ error: "Full name must be 2-100 characters." }, { status: 400 });
  }

  const passwordError = validatePassword(body.password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  if (body.password !== body.confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const role = normalizeRole(body.role);
  if (!role) {
    return NextResponse.json({ error: "Invalid role. Must be Teacher or QA." }, { status: 400 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${getServerApiBase(request)}/api/users/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-url": request.headers.get("origin") || new URL(request.url).origin,
      },
      body: JSON.stringify({
        email: body.email.toLowerCase().trim(),
        full_name: body.fullName.trim(),
        password: body.password,
        role: toBackendRole(role),
      }),
    });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }

  const payload = (await backendResponse.json().catch(() => null)) as BackendSignupPayload | null;

  if (backendResponse.status === 409) {
    return NextResponse.json({ error: "Email already registered." }, { status: 409 });
  }

  if (!backendResponse.ok) {
    return NextResponse.json(
      { error: extractApiErrorMessage(payload, "Sign up failed. Please try again.") },
      { status: backendResponse.status || 500 },
    );
  }

  if (payload && "status" in payload && payload.status === "pending_verification") {
    return NextResponse.json(
      {
        status: "pending_verification",
        email: payload.email || body.email.toLowerCase().trim(),
        verification_email_sent: payload.verification_email_sent ?? true,
        message: payload.message || "Verification email sent. Please check your inbox before signing in.",
      },
      { status: 202 },
    );
  }

  const signupUserPayload =
    payload && "id" in payload && "email" in payload && "full_name" in payload && "role" in payload
      ? payload
      : null;

  if (!signupUserPayload?.id || !signupUserPayload.email || !signupUserPayload.full_name || !signupUserPayload.role) {
    return NextResponse.json({ error: "Unexpected signup response." }, { status: 502 });
  }

  let token: string;
  try {
    token = await createAuthCookieValue({
      userId: signupUserPayload.id,
      email: signupUserPayload.email,
      fullName: signupUserPayload.full_name,
      role: toAppRole(signupUserPayload.role),
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
      userId: signupUserPayload.id,
      role: toAppRole(signupUserPayload.role),
      expires_in: AUTH_COOKIE_MAX_AGE_SECONDS,
    },
    { status: 201 },
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
