"use client";

import { useCallback, useEffect, useState } from "react";

import type { Role } from "@/lib/auth-cookie";

export type AuthMe = {
  userId: string;
  fullName: string;
  email: string;
  role: Role;
  employeeId?: string;
  phoneNumber?: string;
  department?: string;
  teachingSubject?: string;
  avatarUrl?: string | null;
};

const CACHE_TTL_MS = 30_000;
const AUTH_CHANGED_EVENT = "smart-syllabus-auth-changed";

let cachedValue: AuthMe | null = null;
let cachedAt = 0;
let inFlight: Promise<AuthMe | null> | null = null;

function isFresh(): boolean {
  return cachedAt > 0 && Date.now() - cachedAt < CACHE_TTL_MS;
}

export function invalidateAuthMeCache(): void {
  cachedValue = null;
  cachedAt = 0;
}

export function notifyAuthChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export async function fetchAuthMe(force = false): Promise<AuthMe | null> {
  if (!force && cachedValue && isFresh()) {
    return cachedValue;
  }
  if (!force && inFlight) {
    return inFlight;
  }

  inFlight = fetch("/api/auth/me")
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }
      const payload = (await response.json().catch(() => null)) as AuthMe | null;
      cachedValue = payload;
      cachedAt = Date.now();
      return payload;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function useAuthMe(): {
  user: AuthMe | null;
  loading: boolean;
  refresh: () => Promise<AuthMe | null>;
} {
  const [user, setUser] = useState<AuthMe | null>(cachedValue);
  const [loading, setLoading] = useState(!cachedValue);

  useEffect(() => {
    let cancelled = false;
    void fetchAuthMe()
      .then((value) => {
        if (cancelled) return;
        setUser(value);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function handleAuthChanged() {
      const value = await fetchAuthMe(true);
      setUser(value);
      setLoading(false);
    }
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const value = await fetchAuthMe(true);
    setUser(value);
    setLoading(false);
    return value;
  }, []);

  return { user, loading, refresh };
}
