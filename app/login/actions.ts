"use server";

import { redirect } from "next/navigation";

import { isLocalDemoMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function credentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@") || password.length < 8) {
    redirect("/login?error=请输入有效邮箱和至少八位密码");
  }

  return { email, password };
}

export async function signIn(formData: FormData) {
  if (isLocalDemoMode()) redirect("/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials(formData));

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  if (isLocalDemoMode()) redirect("/dashboard");

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    ...credentials(formData),
    options: { emailRedirectTo: `${siteUrl}/auth/confirm` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.session) {
    redirect("/dashboard");
  }

  redirect("/login?message=注册成功，请检查邮箱完成验证");
}
