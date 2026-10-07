# ADR: 将语音识别模型放在独立 FunASR 服务

## Status

accepted for implementation; production deployment pending

## Context

Vercel Serverless 适合短请求和页面/API，不适合持续加载中文 ASR 模型。当前链路把浏览器音频先发到 Vercel，再由 Vercel 跨区域调用百炼，存在 base64 膨胀、模型供应商单点和非流式等待问题。

## Decision

使用独立 FastAPI 服务加载 FunASR `paraformer-zh-streaming`（可通过环境变量替换模型）。Vercel 保留认证和浏览器契约，通过服务端 `ASR_SERVICE_URL` + `ASR_SERVICE_TOKEN` 发送 WAV；FunASR 异常、超时或未配置时回退现有百炼 `qwen3-asr-flash`。两个服务都只在内存中处理本次音频。

## Alternatives considered

- 继续只用百炼：改动最小，但无法消除供应商可用性和跨区域延迟。
- 在 Vercel 中运行 FunASR：受函数时长、镜像和内存限制，不适合模型常驻。
- 浏览器内运行 Whisper：下载体积和设备性能差异会放大首屏及低端设备延迟。

## Consequences

需要单独部署、监控和升级 ASR 服务，并配置共享令牌。Next.js 不再承担模型生命周期；删除 `ASR_SERVICE_URL` 可立即恢复百炼路径。HTTP 入口先用于兼容 Vercel，后续若需要边录边显字，可在同一服务上增加受令牌保护的 WebSocket 客户端入口。

## Revisit conditions

当真实日志显示 FunASR 的 p95 延迟、内存成本或中文准确率持续劣于百炼，或产品需要浏览器端实时字幕时，重新评估模型、区域和 WebSocket 接入。
