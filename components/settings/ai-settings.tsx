"use client";

import { useEffect, useState, type FormEvent } from "react";
import { loadAiSettings, personalKeyStorageName, type AiSettingsInfo } from "@/lib/ai/personal-key-client";

export function AiSettings() {
  const [info, setInfo] = useState<AiSettingsInfo | null>(null);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

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

  return (
    <section className="mt-6 rounded-2xl border bg-card p-6 shadow-sm" aria-labelledby="ai-settings-title">
      <h2 id="ai-settings-title" className="text-xl font-semibold">AI 服务设置</h2>
      {info ? <>
        <p className="mt-2 text-sm text-muted-foreground">当前模型：{info.model} · {saved ? "使用个人 API Key" : info.defaultConfigured ? "使用服务器默认配置" : "尚未配置 API Key"}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">个人 Key 明文保存在此浏览器，按登录账号区分，不会同步到其他设备；同站脚本和浏览器扩展可能读取它。请只在信任的设备使用，使用后可删除。</p>
        <form onSubmit={save} className="mt-4 space-y-3">
          <label htmlFor="personal-ai-key" className="block text-sm font-medium">个人 API Key</label>
          <div className="flex flex-wrap gap-2">
            <input id="personal-ai-key" type={visible ? "text" : "password"} autoComplete="off" spellCheck={false} value={key} onChange={(event) => setKey(event.target.value)} maxLength={512} className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" placeholder="输入当前服务兼容的 API Key" />
            <button type="button" onClick={() => setVisible(!visible)} className="rounded-lg border px-3 py-2 text-sm">{visible ? "隐藏" : "显示"}</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">保存个人 Key</button>
            {saved ? <button type="button" onClick={remove} className="rounded-lg border px-4 py-2 text-sm">删除个人 Key</button> : null}
          </div>
        </form>
      </> : <p className="mt-2 text-sm text-muted-foreground">正在读取 AI 配置…</p>}
      {message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}
    </section>
  );
}
