import type { Role } from "./auth-cookie";
import { getBackendConnectionErrorMessage, getPublicApiBase } from "./backend-api";

export interface UserRecord {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    createdAt: string;
}

/** DB + FastAPI auth use generator/auditor/admin; app RBAC + cookie use Teacher/QA/Admin. */
export function toBackendRole(role: Role): "generator" | "auditor" | "admin" {
    if (role === "Teacher") return "generator";
    if (role === "QA") return "auditor";
    return "admin";
}

export class AuthApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "AuthApiError";
        this.status = status;
    }
}

export function toAppRole(backendRole: string): Role {
    if (backendRole === "generator") return "Teacher";
    if (backendRole === "auditor") return "QA";
    if (backendRole === "admin") return "Admin";
    throw new Error(`Unknown API role: ${backendRole}`);
}

async function readApiErrorMessage(response: Response): Promise<string> {
    const raw = await response.json().catch(() => ({}));
    const obj = raw as Record<string, unknown>;
    if (typeof obj.error === "string" && obj.error) return obj.error;
    const detail = obj.detail;
    if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0] as Record<string, unknown>;
        if (typeof first.msg === "string") return first.msg;
    }
    return `HTTP ${response.status}`;
}

export async function createUser(
    email: string,
    fullName: string,
    password: string,
    role: Role,
    apiBase = getPublicApiBase(),
): Promise<UserRecord> {
    let response: Response;
    try {
        response = await fetch(`${apiBase}/api/users/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: email.toLowerCase().trim(),
                full_name: fullName.trim(),
                password,
                role: toBackendRole(role),
            }),
        });
    } catch {
        throw new Error(getBackendConnectionErrorMessage());
    }

    if (response.status === 409) {
        throw new AuthApiError("EMAIL_EXISTS", 409);
    }
    if (!response.ok) {
        throw new AuthApiError(await readApiErrorMessage(response), response.status || 500);
    }

    const data = (await response.json()) as {
        id: string;
        email: string;
        full_name: string;
        role: string;
        created_at: string;
    };

    return {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        role: toAppRole(data.role),
        createdAt: data.created_at,
    };
}

export async function verifyCredentials(
    email: string,
    password: string,
    apiBase = getPublicApiBase(),
): Promise<UserRecord | null> {
    let response: Response;
    try {
        response = await fetch(`${apiBase}/api/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: email.toLowerCase().trim(),
                password,
            }),
        });
    } catch {
        throw new Error(getBackendConnectionErrorMessage());
    }

    if (response.status === 401) {
        return null;
    }
    if (!response.ok) {
        throw new AuthApiError(await readApiErrorMessage(response), response.status || 500);
    }

    const data = (await response.json()) as {
        id: string;
        email: string;
        full_name: string;
        role: string;
        created_at: string;
    };

    return {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        role: toAppRole(data.role),
        createdAt: data.created_at,
    };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function findUserByEmail(_email: string): UserRecord | null {
    return null;
}
