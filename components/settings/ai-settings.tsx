"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getPersonalAiModel, getPersonalAiProvider, loadAiSettings, personalKeyStorageName, personalModelStorageName, personalProviderStorageName, type AiSettingsInfo } from "@/lib/ai/personal-key-client";
import { isValidPersonalAiModel, PERSONAL_AI_MODEL_MAX_LENGTH, PERSONAL_AI_PROVIDER, type PersonalAiProvider } from "@/lib/ai/personal-ai-provider";
import { PersonalAiProviderSelect } from "./personal-ai-provider-select";

export function AiSettings() {
  const [info, setInfo] = useState<AiSettingsInfo | null>(null);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [model, setModel] = useState("");
  const [savedModel, setSavedModel] = useState("");
  const [provider, setProvider] = useState<PersonalAiProvider>(PERSONAL_AI_PROVIDER.server);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const testingRef = useRef(false);

  useEffect(() => {
    let active = true;
    void loadAiSettings().then((next) => {
      const stored = window.localStorage.getItem(personalKeyStorageName(next.scope)) ?? "";
      const storedProvider = getPersonalAiProvider(next.scope);
      const storedModel = getPersonalAiModel(next.scope) ?? "";
      if (active) { setInfo(next); setKey(stored); setSaved(Boolean(stored)); setProvider(storedProvider); setModel(storedModel || next.model); setSavedModel(storedModel); }
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
    const modelValue = model.trim();
    if (modelValue && !isValidPersonalAiModel(modelValue)) {
      setMessage(`模型 ID 需为 1–${PERSONAL_AI_MODEL_MAX_LENGTH} 个不含空格的可打印字符。`);
      return;
    }
    try {
      window.localStorage.setItem(personalKeyStorageName(info.scope), value);
      const modelOverride = modelValue && modelValue !== info.model ? modelValue : "";
      if (modelOverride) window.localStorage.setItem(personalModelStorageName(info.scope), modelOverride);
      else window.localStorage.removeItem(personalModelStorageName(info.scope));
      setKey(value); setSaved(true); setSavedModel(modelOverride); setModel(modelOverride || info.model); setMessage("个人 API Key 和模型设置已保存在此浏览器。");
    } catch { setMessage("保存失败，请检查浏览器存储权限。"); }
  }

  function remove() {
    if (!info) return;
    try {
      window.localStorage.removeItem(personalKeyStorageName(info.scope));
      window.localStorage.removeItem(personalProviderStorageName(info.scope));
      window.localStorage.removeItem(personalModelStorageName(info.scope));
      setKey(""); setSaved(false); setSavedModel(""); setModel(info.model); setVisible(false); setProvider(PERSONAL_AI_PROVIDER.server);
      setMessage("个人 API Key 和模型设置已删除，将使用服务器默认配置。");
    } catch { setMessage("删除失败，请检查浏览器存储权限。"); }
  }

  function changeProvider(next: PersonalAiProvider) {
    if (!info) return;
    try {
      if (next === PERSONAL_AI_PROVIDER.server) window.localStorage.removeItem(personalProviderStorageName(info.scope));
      else window.localStorage.setItem(personalProviderStorageName(info.scope), next);
      setProvider(next);
      setMessage(next === PERSONAL_AI_PROVIDER.qwenPayg ? "个人 Key 将使用千问AI平台按量付费网关。" : "个人 Key 将沿用服务器当前网关。");
    } catch { setMessage("保存服务选择失败，请检查浏览器存储权限。"); }
  }

  async function testConnection() {
    if (!info || testingRef.current) return;
    const value = key.trim();
    if (!value && saved) { setMessage("请填写要测试的 Key，或先删除已保存的个人 Key。"); return; }
    if (value && (value.length > 512 || !/^[\x21-\x7e]+$/.test(value))) {
      setMessage("请输入不含空格、长度不超过 512 个字符的 API Key。"); return;
    }
    const modelValue = model.trim();
    if (value && modelValue && !isValidPersonalAiModel(modelValue)) {
      setMessage(`模型 ID 需为 1–${PERSONAL_AI_MODEL_MAX_LENGTH} 个不含空格的可打印字符。`); return;
    }
    if (!value && modelValue && modelValue !== info.model) {
      setMessage("模型切换仅适用于个人 Key，请填写个人 Key 后测试该模型。"); return;
    }
    if (!value && !info.defaultConfigured) { setMessage("尚未配置 API Key，请先填写个人 Key。"); return; }
    testingRef.current = true;
    setTesting(true);
    setMessage("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (value) {
        headers["X-OfferPilot-AI-Key"] = value;
        headers["X-OfferPilot-AI-User"] = info.scope;
        if (provider !== PERSONAL_AI_PROVIDER.server) headers["X-OfferPilot-AI-Provider"] = provider;
        if (modelValue && modelValue !== info.model) headers["X-OfferPilot-AI-Model"] = modelValue;
      } else if (provider !== PERSONAL_AI_PROVIDER.server) {
        setMessage("千问AI平台入口仅用于个人 Key；请填写要测试的个人 Key。");
        return;
      }
      const response = await fetch("/api/ai/test-connection", { method: "POST", headers, body: "{}" });
      const data: unknown = await response.json();
      if (!response.ok) {
        const error = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "连接失败，请稍后重试。";
        setMessage(error);
      } else if (data && typeof data === "object" && "ok" in data && data.ok === true) {
        setMessage(value ? `连接成功：个人 Key 可访问模型 ${modelValue || info.model}（${provider === PERSONAL_AI_PROVIDER.qwenPayg ? "千问AI平台按量付费" : "服务器当前网关"}）。` : "连接成功：服务器默认配置可访问该模型。");
      } else setMessage("连接测试返回内容无效，请稍后重试。");
    } catch { setMessage("连接测试请求失败，请检查网络后重试。"); }
    finally { testingRef.current = false; setTesting(false); }
  }

  return (
    <section className="mt-6 rounded-2xl border bg-card p-6 shadow-sm" aria-labelledby="ai-settings-title">
      <h2 id="ai-settings-title" className="text-xl font-semibold">AI 服务设置</h2>
      {info ? <>
        <p className="mt-2 text-sm text-muted-foreground">当前模型：{saved && savedModel ? savedModel : info.model} · {saved ? `使用个人 API Key（${provider === PERSONAL_AI_PROVIDER.qwenPayg ? "千问AI平台按量付费" : "服务器当前网关"}）` : info.defaultConfigured ? "使用服务器默认配置" : "尚未配置 API Key"}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">个人 Key 明文保存在此浏览器，按登录账号区分，不会同步到其他设备；同站脚本和浏览器扩展可能读取它。请只在信任的设备使用，使用后可删除。</p>
        <form onSubmit={save} className="mt-4 space-y-3">
          <PersonalAiProviderSelect value={provider} onChange={changeProvider} disabled={testing} />
          <label htmlFor="personal-ai-model" className="block text-sm font-medium">个人 Key 使用的模型 ID</label>
          <input id="personal-ai-model" type="text" autoComplete="off" spellCheck={false} value={model} disabled={testing} onChange={(event) => { setModel(event.target.value); setMessage(""); }} maxLength={PERSONAL_AI_MODEL_MAX_LENGTH} className="w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-50" placeholder={info.model || "输入服务商控制台中的模型 ID"} />
          <p className="text-xs leading-5 text-muted-foreground">填写服务商控制台中此 Key 可用的精确模型 ID；留空或与当前默认模型相同则沿用默认值。只影响个人 Key，切换模型可能受账号权限和服务商可用性限制。</p>
          <label htmlFor="personal-ai-key" className="block text-sm font-medium">个人 API Key</label>
          <div className="flex flex-wrap gap-2">
            <input id="personal-ai-key" type={visible ? "text" : "password"} autoComplete="off" spellCheck={false} value={key} disabled={testing} onChange={(event) => { setKey(event.target.value); setMessage(""); }} maxLength={512} className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" placeholder="输入当前服务兼容的 API Key" />
            <button type="button" onClick={() => setVisible(!visible)} className="rounded-lg border px-3 py-2 text-sm">{visible ? "隐藏" : "显示"}</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={testing} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">保存个人设置</button>
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
