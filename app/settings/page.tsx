import Link from "next/link";
import { redirect } from "next/navigation";

import { SettingsForm } from "@/components/settings/settings-form";
import { isBrowserDemoMode, isLocalDemoMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const localMode = isLocalDemoMode();
  const demoMode = isBrowserDemoMode();
  if (!localMode) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims) redirect("/login");
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link className="text-sm font-medium text-muted-foreground hover:text-foreground" href="/dashboard">
              ← Dashboard
            </Link>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">训练设置</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              配置第一周期起点、训练日边界和每天的任务数量。
            </p>
          </div>
          <span className="w-fit rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
            {localMode ? (demoMode ? "浏览器 Demo" : "本地 SQLite") : "Supabase 云端"}
          </span>
        </header>
        <SettingsForm demoMode={demoMode} />
      </div>
    </main>
  );
}
