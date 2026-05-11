import { NextRequest, NextResponse } from "next/server";

import {
    AUTH_COOKIE_MAX_AGE_SECONDS,
    AUTH_COOKIE_NAME,
    createAuthCookieValue,
    type Role,
    verifyAuthCookieValue,
} from "@/lib/auth-cookie";
import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";
import { toAppRole } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function jsonWithSession(
    body: Record<string, unknown>,
    session?: {
        userId: string;
        email: string;
        fullName: string;
        role: Role;
    },
): Promise<NextResponse> {
    const response = NextResponse.json(body);
    if (!session) {
        return response;
    }
    try {
        const token = await createAuthCookieValue(session);
        response.cookies.set({
            name: AUTH_COOKIE_NAME,
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
        });
    } catch {
        // If signing fails, preserve the response body and avoid blocking the request.
    }
    return response;
}

export async function GET(request: NextRequest) {
    const payload = await verifyAuthCookieValue(request.cookies.get(AUTH_COOKIE_NAME)?.value);
    if (!payload) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    try {
        const response = await fetch(`${getServerApiBase(request)}/api/users/me`, {
            headers: {
                cookie: request.headers.get("cookie") || "",
            },
            cache: "no-store",
        });
        if (response.ok) {
            const backendPayload = (await response.json().catch(() => null)) as
                | {
                    id?: string;
                    email?: string;
                    full_name?: string;
                    role?: string;
                    employee_id?: string | null;
                    phone_number?: string | null;
                    department?: string | null;
                    teaching_subject?: string | null;
                    avatar_url?: string | null;
                  }
                | null;
            if (backendPayload?.id && backendPayload.email && backendPayload.full_name && backendPayload.role) {
                const role = toAppRole(backendPayload.role);
                return jsonWithSession(
                    {
                        userId: backendPayload.id,
                        email: backendPayload.email,
                        fullName: backendPayload.full_name,
                        role,
                        employeeId: backendPayload.employee_id || "",
                        phoneNumber: backendPayload.phone_number || "",
                        department: backendPayload.department || "",
                        teachingSubject: backendPayload.teaching_subject || "",
                        avatarUrl: backendPayload.avatar_url || null,
                    },
                    {
                        userId: backendPayload.id,
                        email: backendPayload.email,
                        fullName: backendPayload.full_name,
                        role,
                    },
                );
            }
        }
    } catch {
        // Fall back to signed cookie payload below when the backend is temporarily unavailable.
    }

    return jsonWithSession(
        {
            userId: payload.userId,
            email: payload.email,
            fullName: payload.fullName,
            role: payload.role,
            employeeId: "",
            phoneNumber: "",
            department: "",
            teachingSubject: "",
            avatarUrl: null,
        },
        {
            userId: payload.userId,
            email: payload.email,
            fullName: payload.fullName,
            role: payload.role,
        },
    );
}

export async function PATCH(request: NextRequest) {
    const payload = await verifyAuthCookieValue(request.cookies.get(AUTH_COOKIE_NAME)?.value);
    if (!payload) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.text();
    try {
        const response = await fetch(`${getServerApiBase(request)}/api/users/me`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                cookie: request.headers.get("cookie") || "",
            },
            body,
        });
        const backendPayload = (await response.json().catch(() => null)) as
            | {
                error?: string;
                id?: string;
                email?: string;
                full_name?: string;
                role?: string;
                employee_id?: string | null;
                phone_number?: string | null;
                department?: string | null;
                teaching_subject?: string | null;
                avatar_url?: string | null;
              }
            | null;
        if (!response.ok || !backendPayload?.id || !backendPayload.email || !backendPayload.full_name || !backendPayload.role) {
            return NextResponse.json(
                { error: backendPayload?.error || "Unable to update profile." },
                { status: response.status || 500 },
            );
        }

        const role = toAppRole(backendPayload.role);
        return jsonWithSession(
            {
                userId: backendPayload.id,
                email: backendPayload.email,
                fullName: backendPayload.full_name,
                role,
                employeeId: backendPayload.employee_id || "",
                phoneNumber: backendPayload.phone_number || "",
                department: backendPayload.department || "",
                teachingSubject: backendPayload.teaching_subject || "",
                avatarUrl: backendPayload.avatar_url || null,
            },
            {
                userId: backendPayload.id,
                email: backendPayload.email,
                fullName: backendPayload.full_name,
                role,
            },
        );
    } catch {
        return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
    }
}
