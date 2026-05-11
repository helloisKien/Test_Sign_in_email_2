import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import { ClientAppShell } from "@/components/ClientAppShell";
import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const headingFont = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  weight: ["400", "500", "600", "700"],
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
    <html lang="vi" className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const key = "smart-syllabus-theme";
    const stored = localStorage.getItem(key);
    const next = stored === "dark" || stored === "light"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", next);
  } catch (_) {}
})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ClientAppShell>
          <AppNav />
          {children}
        </ClientAppShell>
      </body>
    </html>
  );
}
