import { signIn, signUp } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { authErrorMessage } from "@/lib/supabase/auth-feedback";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const error =
    typeof params.error === "string" ? authErrorMessage(params.error) : null;
  const message = typeof params.message === "string" ? params.message : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <section className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-muted-foreground">OfferPilot</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">登录训练系统</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            记录真实训练表现，按掌握度安排下一次复习。
          </p>
        </div>

        <form className="space-y-4">
          <label className="block space-y-1.5 text-sm font-medium">
            邮箱
            <input
              className="h-10 w-full rounded-lg border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            密码
            <input
              className="h-10 w-full rounded-lg border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="password"
              name="password"
              minLength={8}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">{message}</p>
          ) : null}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button type="submit" formAction={signIn} size="lg">
              登录
            </Button>
            <Button type="submit" formAction={signUp} variant="outline" size="lg">
              注册
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
