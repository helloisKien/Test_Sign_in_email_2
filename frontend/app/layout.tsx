import type { Metadata } from "next";
import Script from "next/script";
import { Be_Vietnam_Pro, Dancing_Script, Merriweather, Playwrite_GB_S } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import { AppFooter } from "@/components/AppFooter";
import { ClientAppShell } from "@/components/ClientAppShell";
import "./globals.css";

const bodyFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const headingFont = Merriweather({
  subsets: ["latin", "vietnamese"],
  variable: "--font-heading",
  display: "swap",
  weight: ["400", "700", "900"],
});

const brandFont = Playwrite_GB_S({
  variable: "--font-brand",
  style: ["normal", "italic"],
  weight: ["300", "400"],
  display: "swap",
});

const quoteFont = Dancing_Script({
  subsets: ["latin", "vietnamese"],
  variable: "--font-quote",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smart Syllabus Studio",
  description: "Smart workspace for ABET-aligned syllabus generation and auditing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${bodyFont.variable} ${headingFont.variable} ${brandFont.variable} ${quoteFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">{`(() => {
  try {
    const key = "smart-syllabus-theme";
    const stored = localStorage.getItem(key);
    const next = stored === "dark" || stored === "light"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", next);
  } catch (_) {}
})();`}</Script>
        <ClientAppShell>
          <AppNav />
          {children}
          <AppFooter />
        </ClientAppShell>
      </body>
    </html>
  );
}
