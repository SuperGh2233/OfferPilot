import type { Metadata } from "next";
import Script from "next/script";

import { AppNavigation } from "@/components/app-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfferPilot",
  description: "个人秋招训练系统",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html className="h-full antialiased" lang="zh-CN" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <Script id="offerpilot-theme" strategy="beforeInteractive">
          {`try{const t=localStorage.getItem("offerpilot:theme");const d=t? t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch{}`}
        </Script>
        <AppNavigation />
        <div className="flex-1" id="main-content" tabIndex={-1}>{children}</div>
      </body>
    </html>
  );
}
