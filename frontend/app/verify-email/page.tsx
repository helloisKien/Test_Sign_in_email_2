"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);
  const tokenMissing = !token;
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tokenMissing) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/auth/verify-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          const payload = await response.json().catch(() => null);
          if (cancelled) return;
          if (!response.ok) {
            setError(payload?.error || "Could not verify your email.");
            return;
          }
          setStatus(payload?.message || "Email verified successfully. You can now sign in.");
        } catch {
          if (!cancelled) {
            setError("Network error. Please try again.");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [token, tokenMissing]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_18%),linear-gradient(180deg,_#faf7f2_0%,_#f2ede4_100%)] p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <h1 className="text-center text-2xl font-semibold text-stone-900">Email verification</h1>
        <p className="mt-2 text-center text-sm text-stone-500">Confirming your account now.</p>

        {tokenMissing ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Verification token is missing.
          </div>
        ) : null}

        {!tokenMissing && loading ? (
          <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
            Verifying your email...
          </div>
        ) : null}

        {status ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {status}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <p className="mt-6 text-center text-sm text-stone-500">
          Continue to{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_18%),linear-gradient(180deg,_#faf7f2_0%,_#f2ede4_100%)] p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 text-center text-sm text-stone-500 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            Loading verification...
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
