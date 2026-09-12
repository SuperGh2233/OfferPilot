"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-[65vh] w-full max-w-xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-destructive">页面暂时不可用</p>
        <h1 className="mt-2 text-2xl font-semibold">训练数据加载失败</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          本地数据不会因此被清除。可以先重试；如果问题持续，返回 Dashboard 再进入。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={retry} type="button">重新加载</Button>
          <Link className="inline-flex h-8 items-center rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted" href="/dashboard">
            返回 Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
