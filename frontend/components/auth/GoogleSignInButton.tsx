"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import type { Role } from "@/lib/auth-cookie";
import { invalidateAuthMeCache, notifyAuthChanged } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n/I18nProvider";

type GoogleSignInButtonProps = {
  intent: "login" | "signup";
  selectedRole?: Role | null;
  onError: (message: string | null) => void;
  onLoadingChange: (loading: boolean) => void;
  onSuccess: (role: Role) => void;
};

const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_INIT_KEY = "__smartSyllabusGoogleClientId";

type SmartSyllabusWindow = Window & {
  [GOOGLE_INIT_KEY]?: string;
};

export function GoogleSignInButton({
  intent,
  selectedRole = null,
  onError,
  onLoadingChange,
  onSuccess,
}: GoogleSignInButtonProps) {
  const { t } = useI18n();
  const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const latestRoleRef = useRef<Role | null>(selectedRole);
  const latestIntentRef = useRef<"login" | "signup">(intent);
  const initializedRef = useRef(false);
  const onErrorRef = useRef(onError);
  const onLoadingChangeRef = useRef(onLoadingChange);
  const onSuccessRef = useRef(onSuccess);
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.google?.accounts?.id),
  );
  const [resetNonce, setResetNonce] = useState(0);
  const tRef = useRef(t);

  const hardResetGoogle = () => {
    const googleId = window.google?.accounts?.id;
    if (!googleId) {
      return;
    }
    googleId.disableAutoSelect?.();
    googleId.cancel?.();
    initializedRef.current = false;
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
    setResetNonce((value) => value + 1);
    window.setTimeout(() => {
      googleId.prompt?.();
    }, 0);
  };

  useEffect(() => {
    latestRoleRef.current = selectedRole;
    latestIntentRef.current = intent;
    onErrorRef.current = onError;
    onLoadingChangeRef.current = onLoadingChange;
    onSuccessRef.current = onSuccess;
    tRef.current = t;
  }, [intent, onError, onLoadingChange, onSuccess, selectedRole, t]);

  useEffect(() => {
    if (!scriptReady || !clientId || !containerRef.current || !window.google?.accounts?.id) {
      return;
    }

    const smartWindow = window as SmartSyllabusWindow;
    const googleId = window.google.accounts.id;
    googleId.disableAutoSelect();
    if (!initializedRef.current || smartWindow[GOOGLE_INIT_KEY] !== clientId) {
      googleId.initialize({
        client_id: clientId,
        auto_select: false,
        callback: async (response) => {
          if (!response.credential) {
            onErrorRef.current(tRef.current("google.err_credential"));
            return;
          }

          if (latestIntentRef.current === "signup" && !latestRoleRef.current) {
            onErrorRef.current(tRef.current("google.err_role"));
            return;
          }

          onLoadingChangeRef.current(true);
          onErrorRef.current(null);

          try {
            const apiResponse = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                credential: response.credential,
                intent: latestIntentRef.current,
                role: latestRoleRef.current,
              }),
            });

            const payload = (await apiResponse.json().catch(() => null)) as
              | { error?: string; role?: Role }
              | null;

            if (!apiResponse.ok || !payload?.role) {
              onErrorRef.current(payload?.error || tRef.current("google.err_fail"));
              return;
            }

            invalidateAuthMeCache();
            notifyAuthChanged();
            onSuccessRef.current(payload.role);
          } catch {
            onErrorRef.current(tRef.current("google.err_network"));
          } finally {
            onLoadingChangeRef.current(false);
          }
        },
      });
      smartWindow[GOOGLE_INIT_KEY] = clientId;
      initializedRef.current = true;
    }

    containerRef.current.innerHTML = "";
    googleId.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: intent === "signup" ? "signup_with" : "signin_with",
      width: Math.max(containerRef.current.clientWidth, 280),
    });
  }, [clientId, intent, resetNonce, scriptReady]);

  if (!clientId) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-center text-sm text-stone-500">
        {t("google.missing_client")}
      </div>
    );
  }

  return (
    <>
      <Script
        id={GOOGLE_SCRIPT_ID}
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div
        ref={containerRef}
        className="flex min-h-11 w-full items-center justify-center overflow-hidden rounded-xl"
      />
      <button
        type="button"
        className="mt-3 w-full text-center text-xs font-medium text-stone-500 underline-offset-2 hover:text-stone-700 hover:underline"
        onClick={() => {
          onErrorRef.current(null);
          hardResetGoogle();
        }}
      >
        {t("google.use_other")}
      </button>
    </>
  );
}
