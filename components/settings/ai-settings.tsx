"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { loadAiSettings, personalKeyStorageName, type AiSettingsInfo } from "@/lib/ai/personal-key-client";

export function AiSettings() {
  const [info, setInfo] = useState<AiSettingsInfo | null>(null);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const testingRef = useRef(false);

  useEffect(() => {
    let active = true;
    void loadAiSettings().then((next) => {
      const stored = window.localStorage.getItem(personalKeyStorageName(next.scope)) ?? "";
      if (active) { setInfo(next); setKey(stored); setSaved(Boolean(stored)); }
    }).catch(() => { if (active) setMessage("无法读取 AI 设置或浏览器存储，请检查登录状态和浏览器权限。"); });
    return () => { active = false; };
  }, []);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!info) return;
    const value = key.trim();
    if (!value || value.length > 512 || !/^[\x21-\x7e]+$/.test(value)) {
      setMessage("请输入不含空格、长度不超过 512 个字符的 API Key。");
      return;
    }
    try {
      window.localStorage.setItem(personalKeyStorageName(info.scope), value);
      setKey(value); setSaved(true); setMessage("个人 API Key 已保存在此浏览器。");
    } catch { setMessage("保存失败，请检查浏览器存储权限。"); }
  }

  function remove() {
    if (!info) return;
    try {
      window.localStorage.removeItem(personalKeyStorageName(info.scope));
      setKey(""); setSaved(false); setVisible(false);
      setMessage("个人 API Key 已删除，将使用服务器默认配置。");
    } catch { setMessage("删除失败，请检查浏览器存储权限。"); }
  }

  async function testConnection() {
    if (!info || testingRef.current) return;
    const value = key.trim();
    if (!value && saved) { setMessage("请填写要测试的 Key，或先删除已保存的个人 Key。"); return; }
    if (value && (value.length > 512 || !/^[\x21-\x7e]+$/.test(value))) {
      setMessage("请输入不含空格、长度不超过 512 个字符的 API Key。"); return;
    }
    if (!value && !info.defaultConfigured) { setMessage("尚未配置 API Key，请先填写个人 Key。"); return; }
    testingRef.current = true;
    setTesting(true);
    setMessage("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (value) { headers["X-OfferPilot-AI-Key"] = value; headers["X-OfferPilot-AI-User"] = info.scope; }
      const response = await fetch("/api/ai/test-connection", { method: "POST", headers, body: "{}" });
      const data: unknown = await response.json();
      if (!response.ok) {
        const error = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "连接失败，请稍后重试。";
        setMessage(error);
      } else if (data && typeof data === "object" && "ok" in data && data.ok === true) {
        setMessage(value ? "连接成功：当前输入的个人 Key 可访问该模型。" : "连接成功：服务器默认配置可访问该模型。");
      } else setMessage("连接测试返回内容无效，请稍后重试。");
    } catch { setMessage("连接测试请求失败，请检查网络后重试。"); }
    finally { testingRef.current = false; setTesting(false); }
  }

  return (
    <section className="mt-6 rounded-2xl border bg-card p-6 shadow-sm" aria-labelledby="ai-settings-title">
      <h2 id="ai-settings-title" className="text-xl font-semibold">AI 服务设置</h2>
      {info ? <>
        <p className="mt-2 text-sm text-muted-foreground">当前模型：{info.model} · {saved ? "使用个人 API Key" : info.defaultConfigured ? "使用服务器默认配置" : "尚未配置 API Key"}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">个人 Key 明文保存在此浏览器，按登录账号区分，不会同步到其他设备；同站脚本和浏览器扩展可能读取它。请只在信任的设备使用，使用后可删除。</p>
        <form onSubmit={save} className="mt-4 space-y-3">
          <label htmlFor="personal-ai-key" className="block text-sm font-medium">个人 API Key</label>
          <div className="flex flex-wrap gap-2">
            <input id="personal-ai-key" type={visible ? "text" : "password"} autoComplete="off" spellCheck={false} value={key} disabled={testing} onChange={(event) => { setKey(event.target.value); setMessage(""); }} maxLength={512} className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" placeholder="输入当前服务兼容的 API Key" />
            <button type="button" onClick={() => setVisible(!visible)} className="rounded-lg border px-3 py-2 text-sm">{visible ? "隐藏" : "显示"}</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={testing} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">保存个人 Key</button>
            {saved ? <button type="button" onClick={remove} disabled={testing} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">删除个人 Key</button> : null}
            <button type="button" onClick={testConnection} disabled={testing} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">{testing ? "正在测试…" : "测试连接"}</button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">测试当前输入的 Key，不会自动保存；未填写时测试服务器默认配置。测试会发起一次短请求，可能产生少量费用。</p>
        </form>
      </> : <p className="mt-2 text-sm text-muted-foreground">正在读取 AI 配置…</p>}
      {message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}
    </section>
  );
}
