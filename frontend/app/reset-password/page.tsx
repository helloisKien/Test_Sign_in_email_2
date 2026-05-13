"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least 1 uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least 1 digit.";
  return null;
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = useMemo(
    () => (searchParams.get("token") || searchParams.get("reset_token") || "").trim(),
    [searchParams],
  );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) {
      setError("Reset token is missing or invalid.");
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || "Could not reset password.");
        return;
      }
      setStatus("Password updated. You can now sign in with your new password.");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_18%),linear-gradient(180deg,_#faf7f2_0%,_#f2ede4_100%)] p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <h1 className="text-center text-2xl font-semibold text-stone-900">Set a new password</h1>
        <p className="mt-2 text-center text-sm text-stone-500">
          Use the secure link from your email to choose a new password.
        </p>

        {!token ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This reset link is missing a token. Request a new password reset from the login page.
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-stone-700">
                New password
              </label>
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 chars, 1 uppercase, 1 number"
                className="w-full rounded-2xl border border-[#d9dee8] bg-[#fbfbfc] px-4 py-3 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-stone-700">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-2xl border border-[#d9dee8] bg-[#fbfbfc] px-4 py-3 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
              />
            </div>
            <button
              type="button"
              className="text-xs font-medium text-stone-500 hover:text-stone-700"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? "Hide password" : "Show password"}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-full bg-[#e67700] px-4 py-3 font-bold text-white shadow-[0_8px_16px_rgba(230,119,0,0.2)] transition-colors hover:bg-[#c75f00] disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}

        {status ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {status}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <p className="mt-6 text-center text-sm text-stone-500">
          Back to{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_18%),linear-gradient(180deg,_#faf7f2_0%,_#f2ede4_100%)] p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 text-center text-sm text-stone-500 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            Loading reset form...
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
