const RESULT_STORAGE_KEY_BASE = "smart-syllabus-current-result";

function normalizeEmail(email?: string | null): string | null {
  const normalized = (email || "").trim().toLowerCase();
  return normalized || null;
}

export function getResultStorageKey(email?: string | null): string {
  const normalizedEmail = normalizeEmail(email);
  return normalizedEmail ? `${RESULT_STORAGE_KEY_BASE}:${normalizedEmail}` : RESULT_STORAGE_KEY_BASE;
}

export function saveResultPayload(payload: unknown, email?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  const storageKey = getResultStorageKey(email);
  sessionStorage.setItem(storageKey, JSON.stringify(payload));
  if (storageKey !== RESULT_STORAGE_KEY_BASE) {
    sessionStorage.removeItem(RESULT_STORAGE_KEY_BASE);
  }
}

function parseStoredPayload<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readResultPayloadForUser<T extends { ownerEmail?: string | null }>(email?: string | null): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const scopedPayload = parseStoredPayload<T>(sessionStorage.getItem(getResultStorageKey(normalizedEmail)));
  if (scopedPayload) {
    return scopedPayload;
  }

  if (!normalizedEmail) {
    return parseStoredPayload<T>(sessionStorage.getItem(RESULT_STORAGE_KEY_BASE));
  }

  const legacyPayload = parseStoredPayload<T>(sessionStorage.getItem(RESULT_STORAGE_KEY_BASE));
  if (!legacyPayload) {
    return null;
  }

  const ownerEmail = normalizeEmail(legacyPayload.ownerEmail);
  return ownerEmail && ownerEmail === normalizedEmail ? legacyPayload : null;
}

export function clearStoredResults(): void {
  if (typeof window === "undefined") {
    return;
  }
  const keysToDelete: string[] = [];
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key && key.startsWith(RESULT_STORAGE_KEY_BASE)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => sessionStorage.removeItem(key));
}
