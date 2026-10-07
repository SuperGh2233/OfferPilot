# REQ/PLAN: 稳定八股语音转写

## Problem and business outcome

当前浏览器录音经 Vercel 转成 WAV、再以 base64 调用百炼非流式识别。音频编码、base64 体积、跨区域网络和单一供应商故障叠加后，用户感知到延迟高且偶发失败。个人用户需要更稳定的中文转写，不需要多用户计费系统。

## Users and workflow

用户在 Knowledge Recall 或模拟面试中点击语音输入，浏览器本地录音并转成 16 kHz 单声道 WAV；Vercel 认证请求后优先调用独立 FunASR 服务，成功返回文字，服务异常时自动调用现有百炼接口。

## Scope

- 新增可独立部署的 FastAPI + FunASR 服务，内存处理 WAV，不落盘音频。
- Vercel 服务端根据 `ASR_SERVICE_URL` 和 `ASR_SERVICE_TOKEN` 调用 FunASR；未配置或调用失败时回退百炼。
- 保留现有认证、输入校验、超时和用户可见错误；新增阶段耗时日志，日志不包含音频、base64 或密钥。
- 录音上限收紧为 30 秒，减少请求体和等待时间。

## Non-goals

- 本轮不增加用户级额度表或 Supabase Migration。
- 不把 FunASR 模型加载到 Vercel，也不在浏览器暴露任何 ASR/API 密钥。
- 不保存原始音频，不改变 Attempt、Mastery 或 Recall 数据结构。
- 不把本地质量门当作 FunASR 外部部署或生产验收。

## Current evidence and constraints

- Next.js 16 App Router 部署在 Vercel；Supabase 只负责 Auth、Postgres 和 RLS。
- 当前百炼 `qwen3-asr-flash` 链路已经有严格 base64/MIME/文本长度校验和 30 秒服务超时。
- Vercel Serverless 不适合长期加载 FunASR 模型；ASR 必须作为单独服务部署。
- 项目要求 Node.js `>=22.13.0`，完整质量门为 lint、typecheck、test、build。

## Requirements

1. FunASR 服务必须提供健康检查和 `POST /transcribe`，只接受 16-bit PCM 16 kHz WAV 原始请求体。
2. 服务通过共享令牌保护转写接口；令牌缺失时只适合本地开发，生产部署文档必须要求配置。
3. Vercel 调用 FunASR 超时或返回无效结果时，且百炼已配置，必须继续尝试百炼；两者都不可用时返回现有可理解的错误状态。
4. 阶段日志只记录 provider、是否 fallback、状态和耗时，不记录请求体或 Authorization。
5. 原有百炼接口在未配置 `ASR_SERVICE_URL` 时行为保持兼容。

## Data/API/state contracts

详见 [`docs/specs/SPEC-20261007-asr-http.md`](../../specs/SPEC-20261007-asr-http.md)。Vercel 对浏览器仍提供 `{ audioBase64, mimeType }`，成功响应仍为 `{ text }`；FunASR 是内部服务边界。

## Implementation plan

- [x] 添加 FastAPI FunASR 服务、模型配置、健康检查、默认强制令牌校验、流式请求体大小限制和 Docker 运行入口；匿名调试必须显式 opt-in。
- [x] 添加 Vercel FunASR provider、fallback 编排、阶段日志和 30 秒录音上限。
- [x] 添加 provider、fallback、超时、空结果、配置缺失和密钥不泄露回归测试。
- [x] 更新环境变量示例、README、架构/运维文档。
- [x] 用便携 Node 24.19 执行 lint、typecheck、test、build；45 个测试文件、421 项测试、242 个页面，Python 入口语法编译通过。
- [ ] FunASR 服务部署后执行 `/healthz`、真实语音、故障回退和 Vercel 登录态验收。

## Risks and rollback

- FunASR CPU 模型首次启动慢、内存高或模型下载失败。健康检查必须反映未就绪；删除 `ASR_SERVICE_URL` 即可回退百炼。
- FunASR 服务跨区域时仍可能有网络延迟。优先把服务部署在靠近用户和 Vercel 的区域，并以日志实测调整。
- 模型输出契约可能随 FunASR 版本变化。服务端固定依赖范围并以无效响应保护 Vercel。
- 回滚只需回退 Next.js 代码或取消 `ASR_SERVICE_URL`；不涉及数据库迁移和用户数据。

## Acceptance criteria

- [x] 未配置 FunASR 时现有百炼测试全部通过。
- [x] 配置 FunASR mock 时请求带共享令牌、成功返回转写；FunASR 失败时百炼 fallback 成功。
- [x] 超时、空文本、无效 JSON、超限音频和错误 MIME 均有稳定状态码/提示。
- [x] `npm run lint && npm run typecheck && npm run test && npm run build` 全部通过。
- [ ] 外部服务部署后的健康检查、真实中文短音频、断开 FunASR 后百炼回退均有记录。

## Verification evidence

本地证据：便携 Node 24.19 下 lint/typecheck/test/build 全部通过（45 个测试文件、421 项测试、242 个页面）；`python3 -m py_compile asr-service/app.py` 与 `git diff --check` 通过。外部服务部署和真实 Vercel 账号验收尚未执行。

## Status and next action

Status: active. 当前下一步是部署独立 FunASR 服务并完成 `/healthz`、真实短音频、故障回退和 Vercel 登录态验收。
