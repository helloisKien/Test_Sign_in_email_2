import type { Metadata } from "next";
import { AppNav } from "@/components/AppNav";
import { ClientAppShell } from "@/components/ClientAppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio Đề cương Thông minh",
  description: "Không gian tạo và thẩm định đề cương gắn với chuẩn ABET",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className="h-full antialiased"
      suppressHydrationWarning
    >
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
