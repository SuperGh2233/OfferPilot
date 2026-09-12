export default function Loading() {
  return (
    <main aria-live="polite" className="mx-auto flex min-h-[60vh] w-full max-w-6xl items-center px-4 py-10 sm:px-6" role="status">
      <div className="w-full space-y-4">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="h-9 w-64 max-w-full animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 pt-4 sm:grid-cols-2">
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        </div>
        <span className="sr-only">正在加载训练数据</span>
      </div>
    </main>
  );
}
