"use client";

import Image from "next/image";
import Link from "next/link";

import { useAuthMe } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n/I18nProvider";

type IconProps = {
  className?: string;
};

function ShieldIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3L5 5.8V11c0 4.2 2.8 7.8 7 9.2 4.2-1.4 7-5 7-9.2V5.8L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9.4 12l1.7 1.7 3.6-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M8.5 12.2l2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 19v-1.4c0-1.9-1.6-3.4-3.5-3.4h-5C5.6 14.2 4 15.7 4 17.6V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 10.8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" />
      <path d="M20 19v-1.2c0-1.6-1-2.9-2.5-3.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16.5 5.1a2.8 2.8 0 0 1 0 5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BoltIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2L5 13h6l-1 9 9-13h-6l0-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19h4l10-10a2.1 2.1 0 0 0-3-3L6 16l-1 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 8l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ClipboardIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 5h6l1 2h2v13H6V7h2l1-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MessageIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5h14v10H9l-4 4V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function workspaceHref(role: string | undefined): string {
  if (role === "QA") {
    return "/auditor";
  }
  return "/generator";
}

export default function Home() {
  const { t } = useI18n();
  const { user } = useAuthMe();

  const overviewCards = [
    {
      title: t("home.over1_t"),
      body: t("home.over1_b"),
      icon: <CheckIcon className="h-6 w-6" />,
      shell: "border-[#f7df78] bg-[#fff5be]",
      iconClass: "text-[#e36f00]",
    },
    {
      title: t("home.over2_t"),
      body: t("home.over2_b"),
      icon: <UsersIcon className="h-6 w-6" />,
      shell: "border-[#8cebdc] bg-[#c8f7ee]",
      iconClass: "text-[#057c73]",
    },
    {
      title: t("home.over3_t"),
      body: t("home.over3_b"),
      icon: <BoltIcon className="h-6 w-6" />,
      shell: "border-[#f6c990] bg-[#ffecd2]",
      iconClass: "text-[#ff4f00]",
    },
  ];

  const featureItems = [
    {
      title: t("home.feature1_t"),
      body: t("home.feature1_b"),
      icon: <EditIcon className="h-5 w-5" />,
      shell: "bg-[#fff0bd] text-[#d86b00]",
    },
    {
      title: t("home.feature2_t"),
      body: t("home.feature2_b"),
      icon: <ClipboardIcon className="h-5 w-5" />,
      shell: "bg-[#c8f7ee] text-[#087a72]",
    },
    {
      title: t("home.feature3_t"),
      body: t("home.feature3_b"),
      icon: <MessageIcon className="h-5 w-5" />,
      shell: "bg-[#ffe2c3] text-[#ef4c00]",
    },
    {
      title: t("home.feature4_t"),
      body: t("home.feature4_b"),
      icon: <CheckIcon className="h-5 w-5" />,
      shell: "bg-[#dce9ff] text-[#2563eb]",
    },
  ];

  const workflowSteps = [
    { number: "01", title: t("home.w1_t"), body: t("home.w1_b"), color: "bg-[#e57900]" },
    { number: "02", title: t("home.w2_t"), body: t("home.w2_b"), color: "bg-[#087c73]" },
    { number: "03", title: t("home.w3_t"), body: t("home.w3_b"), color: "bg-[#ff4f00]" },
    { number: "04", title: t("home.w4_t"), body: t("home.w4_b"), color: "bg-[#111827]" },
  ];

  return (
    <main className="home-refactor min-h-screen bg-[#fbfaf7] text-[#091225]">
      <section className="mx-auto grid max-w-7xl items-center gap-7 px-5 pb-10 pt-8 sm:gap-8 sm:px-6 sm:pb-12 sm:pt-10 md:grid-cols-[1.1fr_0.9fr] md:gap-8 lg:gap-12 lg:px-8 lg:pb-16 lg:pt-14">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#647084]">{t("home.badge")}</p>
          <h1 className="mt-3 max-w-[35rem] font-sans text-[1.85rem] font-black leading-[1.05] tracking-tight text-[#091225] sm:text-[2.25rem] sm:leading-[1] md:text-[2.6rem] lg:text-[3.65rem] lg:leading-[1]">
            {t("home.hero_title_a")} <span className="text-[#df6f00]">{t("home.hero_title_b")}</span> {t("home.hero_title_c")}
          </h1>
          <p className="mt-4 max-w-[33rem] text-[1.13rem] leading-8 tracking-normal text-[#334155] sm:text-[1.18rem]">
            {t("home.hero_body")}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={workspaceHref(user?.role)}
              data-guide="workspace-link"
              className="rounded-full bg-[#e67700] px-7 py-3.5 text-base font-bold tracking-normal text-white shadow-[0_12px_24px_rgba(230,119,0,0.25)] transition hover:bg-[#c75f00]"
            >
              {t("home.cta_start")}
            </Link>
            <Link
              href="/history"
              className="rounded-full border border-[#d9dee8] bg-white px-7 py-3.5 text-base font-bold tracking-normal text-stone-900 shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition hover:border-[#c6cdd9] dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:border-slate-600"
            >
              {t("home.cta_history")}
            </Link>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-2.5 text-xs font-semibold uppercase tracking-normal text-[#111827]">
            <span>{t("home.tags_label")}</span>
            <span className="rounded-full bg-[#fff0bd] px-4 py-1.5 text-[12px] font-medium normal-case text-[#c46100]">{t("home.tag_academic")}</span>
            <span className="rounded-full bg-[#c8f7ee] px-4 py-1.5 text-[12px] font-medium normal-case text-[#04756e]">{t("home.tag_quality")}</span>
            <span className="rounded-full bg-[#ffe1c5] px-4 py-1.5 text-[12px] font-medium normal-case text-[#d64f00]">{t("home.tag_syllabus")}</span>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[20rem] rounded-[1.15rem] border-4 border-white bg-[#d7e7e2] p-0 shadow-[0_18px_36px_rgba(93,86,67,0.18)] sm:max-w-[24rem] md:max-w-[28rem] lg:max-w-[31rem]">
          <Image
            src="/home-syllabus-qa.svg"
            alt={t("home.hero_image_alt")}
            width={1024}
            height={1024}
            priority
            className="aspect-square rounded-[0.95rem] object-cover"
          />
        </div>
      </section>

      <section className="home-surface border-t border-[#eef0f3] bg-[#ffffff] px-5 py-9 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-[#647084]">{t("home.overview_kicker")}</p>
          <h2 className="mt-3 text-center font-sans text-[2.2rem] font-black tracking-normal text-[#091225] sm:text-[2.75rem]">
            {t("home.overview_title")}
          </h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {overviewCards.map((card) => (
              <article key={card.title} className={`home-card rounded-[1.05rem] border p-6 text-center ${card.shell}`}>
                <div className={`mx-auto flex h-15 w-15 items-center justify-center rounded-full bg-[#ffffff] shadow-sm ${card.iconClass}`}>
                  {card.icon}
                </div>
                <h3 className="mt-5 font-sans text-[1.38rem] font-black tracking-normal text-stone-950">{card.title}</h3>
                <p className="mx-auto mt-3 max-w-[18rem] text-[1rem] leading-7 tracking-normal text-[#374151]">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-muted bg-[#f6f7f9] px-5 py-10 sm:px-6 sm:py-11 lg:px-8 lg:py-14">
        <div className="mx-auto max-w-7xl">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-[#647084]">{t("home.feature_kicker")}</p>
          <h2 className="mt-3 text-center font-sans text-[2.15rem] font-black tracking-normal text-[#091225] sm:text-[2.75rem]">
            {t("home.feature_title")}
          </h2>
          <div className="mt-9 grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {featureItems.map((item) => (
              <article key={item.title} className="home-feature grid grid-cols-[3.25rem_1fr] gap-3">
                <div className={`flex h-13 w-13 items-center justify-center rounded-[0.9rem] ${item.shell}`}>{item.icon}</div>
                <div>
                  <h3 className="font-sans text-[1.08rem] font-black tracking-normal text-stone-950">{item.title}</h3>
                  <p className="mt-1.5 text-[0.98rem] leading-6 tracking-normal text-[#5b6472]">{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-surface relative overflow-hidden border-t border-[#eef0f3] bg-[#ffffff] px-5 py-10 sm:px-6 sm:py-11 lg:px-8 lg:py-14">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[#dffaf4] blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-[#647084]">{t("home.process_kicker")}</p>
          <h2 className="mt-3 text-center font-sans text-[2.15rem] font-black tracking-normal text-[#091225] sm:text-[2.75rem]">
            {t("home.process_title")}
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {workflowSteps.map((step) => (
              <article
                key={step.number}
                className="home-card rounded-[1.05rem] border border-[#e8ebef] bg-[#fbfbfc] px-5 py-6 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
              >
                <div className={`mx-auto flex h-15 w-15 items-center justify-center rounded-full ${step.color} text-xl font-black text-white shadow-[0_5px_12px_rgba(15,23,42,0.18)]`}>
                  {step.number}
                </div>
                <h3 className="mt-5 font-sans text-[1.65rem] font-black tracking-normal text-stone-950">{step.title}</h3>
                <p className="mx-auto mt-3 max-w-[17rem] text-[1rem] leading-7 tracking-normal text-[#4b5563]">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="home-footer border-t border-[#e8ebef] bg-[#f6f7f9] px-5 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm tracking-normal text-[#6b7280] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 font-black text-[#e66f00]">
            <ShieldIcon className="h-5 w-5 text-stone-950" />
            <span>{t("home.footer_brand")}</span>
          </div>
          <p>{t("home.footer_copy")}</p>
        </div>
      </footer>
    </main>
  );
}
