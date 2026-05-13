"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { invalidateAuthMeCache, notifyAuthChanged } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getDefaultRouteForRole } from "@/lib/role-routing";

export default function LoginPage() {
    const { t } = useI18n();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotStatus, setForgotStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const legacyToken = new URLSearchParams(window.location.search).get("reset_token");
        if (!legacyToken) {
            return;
        }
        router.replace(`/reset-password?token=${encodeURIComponent(legacyToken)}`);
    }, [router]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!email.trim() || !password) {
            setError(t("login.err_required"));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), password }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                setError(payload?.error || t("login.err_login"));
                return;
            }

            const data = await response.json();
            invalidateAuthMeCache();
            notifyAuthChanged();
            router.replace(getDefaultRouteForRole(data.role));
        } catch {
            setError(t("login.err_network"));
        } finally {
            setLoading(false);
        }
    }

    async function handleForgotPasswordSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!forgotEmail.trim()) {
            setError(t("login.forgot_err_email"));
            return;
        }

        setError(null);
        setForgotStatus(null);
        setForgotLoading(true);

        try {
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: forgotEmail.trim() }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                setError(payload?.error || t("login.forgot_err_send"));
                return;
            }
            setForgotStatus(t("login.forgot_ok"));
        } catch {
            setError(t("login.err_network"));
        } finally {
            setForgotLoading(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#fbfaf7] p-4 text-[#091225]">
            <div className="w-full max-w-md rounded-[1.45rem] border border-[#ece9df] bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                <h1 className="mb-1 text-center font-sans text-2xl font-black text-[#091225]">{t("login.title")}</h1>
                <p className="mb-6 text-center text-sm text-[#4b5563]">{t("login.subtitle")}</p>

                {error ? (
                    <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </p>
                ) : null}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label htmlFor="email" className="mb-1 block text-sm font-medium text-[#374151]">
                            {t("login.email")}
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t("login.placeholder_email")}
                            className="w-full rounded-xl border border-[#d9dee8] bg-[#fbfbfc] px-4 py-3 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="mb-1 block text-sm font-medium text-[#374151]">
                            {t("login.password")}
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t("login.placeholder_password")}
                                className="w-full rounded-xl border border-[#d9dee8] bg-[#fbfbfc] px-4 py-3 pr-24 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md bg-[#fbfbfc] px-2 py-1 text-xs font-medium text-[#647084] hover:text-[#091225]"
                            >
                                {showPassword ? t("common.hide") : t("common.show")}
                            </button>
                        </div>
                        <div className="mt-2 text-right">
                            <button
                                type="button"
                                className="text-xs font-bold text-[#e67700] hover:text-[#c75f00]"
                                onClick={() => {
                                    setShowForgotPassword((prev) => !prev);
                                    setForgotStatus(null);
                                }}
                            >
                                {t("login.forgot")}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || googleLoading}
                        className="mt-2 flex w-full items-center justify-center rounded-full bg-[#e67700] px-4 py-3 font-bold text-white shadow-[0_8px_16px_rgba(230,119,0,0.2)] transition-colors hover:bg-[#c75f00] disabled:opacity-50"
                    >
                        {loading ? t("login.submitting") : t("login.submit")}
                    </button>
                </form>

                <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[#ece9df]" />
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#647084]">{t("common.or")}</span>
                    <div className="h-px flex-1 bg-[#ece9df]" />
                </div>

                <GoogleSignInButton
                    intent="login"
                    onError={setError}
                    onLoadingChange={setGoogleLoading}
                    onSuccess={(role) => router.replace(getDefaultRouteForRole(role))}
                />

                {showForgotPassword ? (
                    <section className="mt-5 rounded-xl border border-[#ece9df] bg-[#fbfbfc] p-4">
                        <h2 className="text-sm font-bold text-[#091225]">{t("login.reset_title")}</h2>
                        <p className="mt-1 text-xs text-[#4b5563]">{t("login.reset_hint")}</p>
                        <form className="mt-3 space-y-3" onSubmit={handleForgotPasswordSubmit}>
                            <input
                                type="email"
                                value={forgotEmail}
                                onChange={(event) => setForgotEmail(event.target.value)}
                                placeholder={t("login.reset_placeholder")}
                                className="w-full rounded-xl border border-[#d9dee8] bg-white px-4 py-3 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20"
                            />
                            <button
                                type="submit"
                                disabled={forgotLoading}
                                className="w-full rounded-xl border border-[#ffd8a8] bg-[#fff4e6] px-4 py-2.5 text-sm font-bold text-[#e67700] hover:bg-[#ffe8cc] disabled:opacity-50"
                            >
                                {forgotLoading ? t("login.reset_sending") : t("login.reset_send")}
                            </button>
                        </form>
                        {forgotStatus ? <p className="mt-3 text-xs font-medium text-emerald-700">{forgotStatus}</p> : null}
                    </section>
                ) : null}

                <p className="mt-6 text-center text-sm text-[#4b5563]">
                    {t("login.no_account")}{" "}
                    <Link href="/signup" className="font-bold text-[#e67700] hover:text-[#c75f00]">
                        {t("login.signup_link")}
                    </Link>
                </p>
            </div>
        </div>
    );
}
