import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="max-w-md rounded-2xl border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">邮箱验证失败</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          验证链接可能已经过期，请返回登录页重新注册或登录。
        </p>
        <Link className="mt-5 inline-block text-sm font-medium underline" href="/login">
          返回登录
        </Link>
      </section>
    </main>
  );
}
