export function authErrorMessage(message: string) {
  const retryAfter = message.match(/after\s+(\d+)\s+seconds?/i)?.[1];

  if (retryAfter) {
    return `请求过于频繁，请等待 ${retryAfter} 秒后再试。`;
  }

  if (message === "Invalid login credentials") {
    return "邮箱或密码错误；如果还没有账号，请点击注册。";
  }

  if (message === "Email not confirmed") {
    return "邮箱尚未验证，请先打开确认邮件。";
  }

  return message;
}

export function loginFeedbackUrl(
  kind: "error" | "message",
  message: string,
) {
  const feedback = kind === "error" ? authErrorMessage(message) : message;
  return `/login?${kind}=${encodeURIComponent(feedback)}`;
}
