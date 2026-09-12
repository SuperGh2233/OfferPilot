import { describe, expect, it } from "vitest";

import {
  authErrorMessage,
  loginFeedbackUrl,
} from "../lib/supabase/auth-feedback";

describe("auth feedback", () => {
  it("keeps Chinese Server Action redirects header-safe", () => {
    const url = loginFeedbackUrl("message", "注册成功，请检查邮箱完成验证");

    expect(url).not.toMatch(/[^\x00-\x7F]/);
    expect(new URLSearchParams(url.split("?")[1]).get("message")).toBe(
      "注册成功，请检查邮箱完成验证",
    );
  });

  it("explains Supabase login and rate-limit errors in Chinese", () => {
    expect(authErrorMessage("Invalid login credentials")).toContain(
      "邮箱或密码错误",
    );
    expect(
      authErrorMessage(
        "For security purposes, you can only request this after 53 seconds.",
      ),
    ).toBe("请求过于频繁，请等待 53 秒后再试。");
  });
});
