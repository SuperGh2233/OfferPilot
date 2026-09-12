import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[65vh] w-full max-w-xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-muted-foreground">404 · Not found</p>
        <h1 className="mt-2 text-2xl font-semibold">这里没有训练内容</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          链接可能已经失效，或者题目不在当前 Hot 100 / 核心八股目录中。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80" href="/dashboard">
            返回今日训练
          </Link>
          <Link className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted" href="/algorithm">
            查看 Hot 100
          </Link>
        </div>
      </section>
    </main>
  );
}
