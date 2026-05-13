"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import type { Role } from "@/lib/auth-cookie";
import { invalidateAuthMeCache, notifyAuthChanged } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getDefaultRouteForRole } from "@/lib/role-routing";

interface FormErrors {
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    role?: string;
    server?: string;
}

const FULL_NAME_PATTERN = /^[\p{L}\s]+$/u;

function getPasswordStrength(password: string): { level: number; labelKey: string; color: string } {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { level: score, labelKey: "signup.pw_weak", color: "bg-red-500" };
    if (score <= 2) return { level: score, labelKey: "signup.pw_fair", color: "bg-orange-500" };
    if (score <= 3) return { level: score, labelKey: "signup.pw_good", color: "bg-yellow-500" };
    if (score <= 4) return { level: score, labelKey: "signup.pw_strong", color: "bg-emerald-500" };
    return { level: score, labelKey: "signup.pw_very_strong", color: "bg-emerald-600" };
}

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
    return (
        <div className={`flex items-center gap-2 text-xs ${met ? "text-emerald-700" : "text-stone-500"}`}>
            <span
                className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold ${
                    met ? "border-emerald-500 bg-emerald-500 text-white" : "border-stone-300 bg-white text-transparent"
                }`}
                aria-hidden="true"
            >
                ✓
            </span>
            <span>{label}</span>
        </div>
    );
}

export default function SignupPage() {
    const { t } = useI18n();
    const router = useRouter();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendStatus, setResendStatus] = useState<string | null>(null);

    const strength = getPasswordStrength(password);
    const passwordRequirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
    };
    const confirmMatches = confirmPassword.length > 0 && password === confirmPassword;

    function validate(): FormErrors {
        const errs: FormErrors = {};
        const normalizedName = fullName.trim();
        if (!normalizedName || normalizedName.length < 2) errs.fullName = t("signup.err_fullname_short");
        if (normalizedName.length > 100) errs.fullName = t("signup.err_fullname_long");
        if (normalizedName && !FULL_NAME_PATTERN.test(normalizedName)) errs.fullName = t("signup.err_fullname_letters");
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = t("signup.err_email");
        if (password.length < 8) errs.password = t("signup.err_password_len");
        else if (!/[A-Z]/.test(password)) errs.password = t("signup.err_password_upper");
        else if (!/[0-9]/.test(password)) errs.password = t("signup.err_password_digit");
        if (password !== confirmPassword) errs.confirmPassword = t("signup.err_confirm");
        if (!selectedRole) errs.role = t("signup.err_role");
        return errs;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const validation = validate();
        if (Object.keys(validation).length > 0) {
            setErrors(validation);
            return;
        }

        setLoading(true);
        setErrors({});

        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: fullName.trim(),
                    email: email.trim(),
                    password,
                    confirmPassword,
                    role: selectedRole,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                setErrors({ server: payload?.error || t("signup.err_signup") });
                return;
            }

            const payload = await response.json().catch(() => null) as {
                status?: string;
                message?: string;
                verification_email_sent?: boolean;
            } | null;
            if (payload?.status === "pending_verification") {
                const sentOk = payload.verification_email_sent !== false;
                setVerificationNotice(
                    sentOk ? (payload.message || t("signup.verify_default")) : t("signup.verify_undelivered"),
                );
                setResendStatus(null);
                return;
            }

            const nextRole = selectedRole;
            if (!nextRole) {
                setErrors({ server: t("signup.err_role_select") });
                return;
            }

            setVerificationNotice(null);
            setResendStatus(null);
            invalidateAuthMeCache();
            notifyAuthChanged();
            router.replace(getDefaultRouteForRole(nextRole));
        } catch {
            setErrors({ server: t("signup.err_network") });
        } finally {
            setLoading(false);
        }
    }

    async function handleResendVerification() {
        if (!email.trim()) {
            setErrors((current) => ({ ...current, email: t("signup.err_resend_email") }));
            return;
        }
        setResendLoading(true);
        setResendStatus(null);
        setErrors((current) => ({ ...current, server: undefined }));
        try {
            const response = await fetch("/api/auth/resend-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim() }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                setErrors((current) => ({
                    ...current,
                    server: payload?.error || t("signup.err_resend"),
                }));
                return;
            }
            setResendStatus(payload?.message || t("signup.ok_resend"));
        } catch {
            setErrors((current) => ({ ...current, server: t("signup.err_network") }));
        } finally {
            setResendLoading(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#fbfaf7] p-4 text-[#091225]">
            <div className="w-full max-w-lg rounded-[1.45rem] border border-[#ece9df] bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                <h1 className="mb-1 text-center font-sans text-2xl font-black text-[#091225]">{t("signup.title")}</h1>
                <p className="mb-6 text-center text-sm text-[#4b5563]">{t("signup.subtitle")}</p>

                {errors.server ? (
                    <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errors.server}
                    </p>
                ) : null}
                {verificationNotice ? (
                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        <p>{verificationNotice}</p>
                        <button
                            type="button"
                            className="mt-2 text-xs font-semibold text-emerald-700 underline-offset-2 hover:text-emerald-900 hover:underline disabled:opacity-50"
                            onClick={() => void handleResendVerification()}
                            disabled={resendLoading}
                        >
                            {resendLoading ? t("signup.resending") : t("signup.resend")}
                        </button>
                        {resendStatus ? <p className="mt-2 text-xs text-emerald-700">{resendStatus}</p> : null}
                    </div>
                ) : null}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-[#374151]">{t("signup.full_name")}</label>
                        <input
                            id="fullName"
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder={t("signup.placeholder_name")}
                            className={`w-full rounded-xl border px-4 py-3 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20 ${errors.fullName ? "border-red-300 bg-red-50" : "border-[#d9dee8] bg-[#fbfbfc]"}`}
                        />
                        {errors.fullName ? <p className="mt-1 text-xs text-red-600">{errors.fullName}</p> : null}
                    </div>

                    <div>
                        <label htmlFor="email" className="mb-1 block text-sm font-medium text-[#374151]">{t("signup.email")}</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t("signup.placeholder_email")}
                            className={`w-full rounded-xl border px-4 py-3 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20 ${errors.email ? "border-red-300 bg-red-50" : "border-[#d9dee8] bg-[#fbfbfc]"}`}
                        />
                        {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
                    </div>

                    <div>
                        <label htmlFor="password" className="mb-1 block text-sm font-medium text-[#374151]">{t("signup.password")}</label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t("signup.placeholder_pw")}
                                className={`w-full rounded-xl border px-4 py-3 pr-12 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20 ${errors.password ? "border-red-300 bg-red-50" : "border-[#d9dee8] bg-[#fbfbfc]"}`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#647084] hover:text-[#091225]"
                            >
                                {showPassword ? t("common.hide") : t("common.show")}
                            </button>
                        </div>
                        {password.length > 0 ? (
                            <div className="mt-2 space-y-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-1.5 flex-1 gap-1">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <div
                                                key={i}
                                                className={`h-full flex-1 rounded-full transition-colors ${i <= strength.level ? strength.color : "bg-stone-200"}`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs font-medium text-stone-500">{t(strength.labelKey)}</span>
                                </div>
                                <PasswordRequirement met={passwordRequirements.length} label={t("signup.pw_req_len")} />
                                <PasswordRequirement met={passwordRequirements.uppercase} label={t("signup.pw_req_upper")} />
                                <PasswordRequirement met={passwordRequirements.number} label={t("signup.pw_req_num")} />
                            </div>
                        ) : null}
                        {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password}</p> : null}
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-[#374151]">{t("signup.confirm_password")}</label>
                        <div className="relative">
                            <input
                                id="confirmPassword"
                                type={showConfirm ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder={t("signup.placeholder_confirm")}
                                className={`w-full rounded-xl border px-4 py-3 pr-12 text-sm text-[#091225] outline-none transition-colors placeholder:text-[#647084] focus:border-[#e67700] focus:ring-2 focus:ring-[#e67700]/20 ${errors.confirmPassword ? "border-red-300 bg-red-50" : "border-[#d9dee8] bg-[#fbfbfc]"}`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#647084] hover:text-[#091225]"
                            >
                                {showConfirm ? t("common.hide") : t("common.show")}
                            </button>
                        </div>
                        {confirmMatches ? (
                            <p className="mt-1 flex items-center gap-2 text-xs font-medium text-emerald-700">
                                <span aria-hidden="true">✓</span>
                                {t("signup.pw_match")}
                            </p>
                        ) : confirmPassword.length > 0 ? (
                            <p className="mt-1 text-xs text-red-600">{t("signup.pw_mismatch")}</p>
                        ) : null}
                        {errors.confirmPassword ? <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p> : null}
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-medium text-[#374151]">{t("signup.role_title")}</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setSelectedRole("Teacher")}
                                className={`rounded-xl border-2 px-4 py-4 text-left transition-all ${selectedRole === "Teacher"
                                        ? "border-[#e67700] bg-[#fff4e6] ring-2 ring-[#e67700]/20"
                                        : "border-[#d9dee8] bg-[#fbfbfc] hover:border-[#c6cdd9]"
                                    }`}
                            >
                                <span className={`block text-sm font-semibold ${selectedRole === "Teacher" ? "text-[#e67700]" : "text-[#091225]"}`}>
                                    {t("signup.teacher")}
                                </span>
                                <span className={`mt-0.5 block text-xs ${selectedRole === "Teacher" ? "text-[#c75f00]" : "text-[#647084]"}`}>
                                    {t("signup.teacher_hint")}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedRole("QA")}
                                className={`rounded-xl border-2 px-4 py-4 text-left transition-all ${selectedRole === "QA"
                                        ? "border-[#057c73] bg-[#e6fbf9] ring-2 ring-[#057c73]/20"
                                        : "border-[#d9dee8] bg-[#fbfbfc] hover:border-[#c6cdd9]"
                                    }`}
                            >
                                <span className={`block text-sm font-semibold ${selectedRole === "QA" ? "text-[#057c73]" : "text-[#091225]"}`}>
                                    {t("signup.qa")}
                                </span>
                                <span className={`mt-0.5 block text-xs ${selectedRole === "QA" ? "text-[#04615a]" : "text-[#647084]"}`}>
                                    {t("signup.qa_hint")}
                                </span>
                            </button>
                        </div>
                        {errors.role ? <p className="mt-1 text-xs text-red-600">{errors.role}</p> : null}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || googleLoading}
                        className="mt-2 flex w-full items-center justify-center rounded-full bg-[#e67700] px-4 py-3 font-bold text-white shadow-[0_8px_16px_rgba(230,119,0,0.2)] transition-colors hover:bg-[#c75f00] disabled:opacity-50"
                    >
                        {loading ? t("signup.submitting") : t("signup.submit")}
                    </button>
                </form>

                <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[#ece9df]" />
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#647084]">{t("common.or")}</span>
                    <div className="h-px flex-1 bg-[#ece9df]" />
                </div>

                <GoogleSignInButton
                    intent="signup"
                    selectedRole={selectedRole}
                    onError={(message) => setErrors((current) => ({ ...current, server: message || undefined }))}
                    onLoadingChange={setGoogleLoading}
                    onSuccess={(role) => router.replace(getDefaultRouteForRole(role))}
                />

                <p className="mt-6 text-center text-sm text-[#4b5563]">
                    {t("signup.have_account")}{" "}
                    <Link href="/login" className="font-bold text-[#e67700] hover:text-[#c75f00]">
                        {t("signup.signin")}
                    </Link>
                </p>
            </div>
        </div>
    );
}
