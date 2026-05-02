"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";

export default function Home() {
  const { t } = useI18n();

  const capabilityCards = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6].map((i) => ({
        title: t(`home.cap${i}_t`),
        body: t(`home.cap${i}_b`),
      })),
    [t],
  );

  const workflowSteps = useMemo(
    () =>
      [1, 2, 3, 4].map((i) => ({
        step: `0${i}`,
        title: t(`home.w${i}_t`),
        body: t(`home.w${i}_b`),
      })),
    [t],
  );

  const quickStats = useMemo(
    () => [
      { label: t("home.stat1_lbl"), value: t("home.stat1_val") },
      { label: t("home.stat2_lbl"), value: t("home.stat2_val") },
      { label: t("home.stat3_lbl"), value: t("home.stat3_val") },
    ],
    [t],
  );

  const impactSignals = useMemo(
    () =>
      [1, 2, 3].map((i) => ({
        title: t(`home.imp${i}_t`),
        body: t(`home.imp${i}_b`),
      })),
    [t],
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(13,148,136,0.14),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#f5f5f4_62%,_#eef2f7_100%)]">
      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-8 pt-14 lg:grid-cols-[1.08fr_0.92fr] lg:pb-12 lg:pt-20">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">{t("home.badge")}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-stone-950 md:text-6xl">{t("home.hero_title")}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">{t("home.hero_body")}</p>
          <div className="mt-4 inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
            {t("home.stat_line")}
          </div>
          <div className="mt-2 text-sm font-medium text-stone-600">{t("home.stat_sub")}</div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/history" className="rounded-xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition-transform hover:bg-stone-800 active:scale-[0.98]">
              {t("home.cta_history")}
            </Link>
            <Link href="/faq" className="rounded-xl border border-teal-300 bg-teal-50 px-5 py-3 text-sm font-semibold text-teal-800 transition-transform hover:bg-teal-100 active:scale-[0.98]">
              {t("home.cta_faq")}
            </Link>
            <Link href="/updates" className="rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition-transform hover:bg-stone-100 active:scale-[0.98]">
              {t("home.cta_updates")}
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2 text-xs font-medium text-stone-500">
            <span className="rounded-full border border-stone-300 bg-white px-3 py-1">{t("home.tag_teacher")}</span>
            <span className="rounded-full border border-stone-300 bg-white px-3 py-1">{t("home.tag_qa")}</span>
            <span className="rounded-full border border-stone-300 bg-white px-3 py-1">{t("home.tag_admin")}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{t("home.snapshot_kicker")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {quickStats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-4">
                <p className="text-2xl font-semibold text-stone-950">{stat.value}</p>
                <p className="mt-1 text-xs text-stone-600">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-sm font-semibold text-teal-900">{t("home.acc_box_title")}</p>
            <p className="mt-1 text-sm text-teal-800">{t("home.acc_box_body")}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">{t("home.cap_kicker")}</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-950 md:text-3xl">{t("home.cap_title")}</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {capabilityCards.map((card) => (
              <article key={card.title} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <h3 className="text-sm font-semibold text-stone-950">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">{t("home.why_kicker")}</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-950 md:text-3xl">{t("home.why_title")}</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {impactSignals.map((signal) => (
              <article key={signal.title} className="rounded-xl border border-stone-200 bg-gradient-to-b from-white to-stone-50 p-4">
                <h3 className="text-sm font-semibold text-stone-950">{signal.title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">{signal.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">{t("home.flow_kicker")}</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-950 md:text-3xl">{t("home.flow_title")}</h2>
          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            {workflowSteps.map((item) => (
              <article key={item.step} className="rounded-xl border border-stone-200 bg-gradient-to-b from-white to-stone-50 p-4">
                <p className="text-xs font-semibold tracking-[0.16em] text-teal-700">
                  {t("home.flow_step")} {item.step}
                </p>
                <h3 className="mt-1 text-base font-semibold text-stone-950">{item.title}</h3>
                <p className="mt-2 text-sm text-stone-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
