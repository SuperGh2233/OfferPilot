"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "今日" },
  { href: "/algorithm", label: "算法" },
  { href: "/knowledge", label: "八股" },
  { href: "/progress", label: "进度" },
  { href: "/settings", label: "设置" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

export function AppNavigation() {
  const pathname = usePathname();

  if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return null;
  }

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    localStorage.setItem("offerpilot:theme", next ? "dark" : "light");
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <a className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:left-3 focus:top-3" href="#main-content">
        跳到主要内容
      </a>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6">
        <Link className="shrink-0 font-semibold tracking-tight" href="/dashboard">
          OfferPilot
        </Link>
        <nav aria-label="主要导航" className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {links.map((link) => (
            <Link
              aria-current={isActive(pathname, link.href) ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(pathname, link.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          aria-label="切换颜色模式"
          className="ml-auto inline-flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-base transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={toggleTheme}
          type="button"
        >
          <span aria-hidden="true">◐</span>
        </button>
      </div>
    </header>
  );
}
