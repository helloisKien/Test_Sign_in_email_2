import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthCookieValue } from "@/lib/auth-cookie";
import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";
import { toAppRole } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
                return NextResponse.json({
                    userId: backendPayload.id,
                    email: backendPayload.email,
                    fullName: backendPayload.full_name,
                    role: toAppRole(backendPayload.role),
                    employeeId: backendPayload.employee_id || "",
                    phoneNumber: backendPayload.phone_number || "",
                    department: backendPayload.department || "",
                    teachingSubject: backendPayload.teaching_subject || "",
                    avatarUrl: backendPayload.avatar_url || null,
                });
            }
        }
    } catch {
        // Fall back to signed cookie payload below when the backend is temporarily unavailable.
    }

    return NextResponse.json({
        userId: payload.userId,
        email: payload.email,
        fullName: payload.fullName,
        role: payload.role,
        employeeId: "",
        phoneNumber: "",
        department: "",
        teachingSubject: "",
        avatarUrl: null,
    });
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

        return NextResponse.json({
            userId: backendPayload.id,
            email: backendPayload.email,
            fullName: backendPayload.full_name,
            role: toAppRole(backendPayload.role),
            employeeId: backendPayload.employee_id || "",
            phoneNumber: backendPayload.phone_number || "",
            department: backendPayload.department || "",
            teachingSubject: backendPayload.teaching_subject || "",
            avatarUrl: backendPayload.avatar_url || null,
        });
    } catch {
        return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
    }
}
