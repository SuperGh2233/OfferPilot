# SPEC: FunASR HTTP 转写接口

> archived，2026-10-08：用户改用系统听写，内置录音/转写接口、FunASR 服务和专属测试已移除。下文仅保留历史契约与部署记录，不再作为当前操作指引。当前方案见 [移除计划](../plans/active/PLAN-20261007-speech-stability.md)。

## Purpose

定义 Vercel 与独立 FunASR 服务之间的内部转写契约，避免模型升级时改变浏览器 API。

## Version and compatibility

当前版本 `v1`。浏览器仍调用 Next.js `/api/ai/transcribe`；FunASR 服务只接受内部请求，不直接暴露给浏览器。

## Field or endpoint definitions

### `GET /healthz`

返回 `200 {"ok":true,"model":"..."}` 表示模型已加载；模型未就绪返回 `503 {"ok":false,"error":"model_not_ready"}`。响应不得包含路径、令牌或异常堆栈。

### `POST /transcribe`

- Header: `Content-Type: audio/wav`
- Header: `Authorization: Bearer <FUNASR_SHARED_TOKEN>`（生产必填）
- Body: 16-bit PCM、单声道、16 kHz WAV bytes；服务限制由 `FUNASR_MAX_AUDIO_BYTES` 控制，默认 2 MiB。
- Success: `200 {"text":"...","provider":"funasr"}`。
- Empty speech: `200 {"text":"","provider":"funasr"}`，由 Vercel 转换为现有 422 提示。
- Client errors: `400/401/413/415` JSON `{ "error": "stable_code" }`。
- Model/provider errors: `502/503` JSON `{ "error": "asr_unavailable" }`，不得返回内部堆栈。

## Types, nullability, defaults, enums

`text` 必须是字符串，Vercel 最多接受 2,000 个 Unicode 字符并去除首尾空白。`provider` 固定为 `funasr`。服务令牌为空时 `/transcribe` 默认拒绝请求；只有显式设置本地开发变量 `FUNASR_ALLOW_ANONYMOUS=true` 才允许匿名调用。

## Source and precedence

服务默认模型为 `paraformer-zh-streaming`；`FUNASR_MODEL` 可替换。Vercel 只有配置 `ASR_SERVICE_URL` 时才优先调用 FunASR；失败后才调用百炼。

## Validation and failure behavior

服务不得把音频写入磁盘或日志。Vercel 必须继续执行已配置的百炼 fallback，并只记录 provider、fallback、状态和耗时。两侧都失败时返回不泄露供应商密钥或原始异常的中文提示。

## Examples

```bash
curl -X POST "$ASR_SERVICE_URL/transcribe" \
  -H "Authorization: Bearer $ASR_SERVICE_TOKEN" \
  -H "Content-Type: audio/wav" \
  --data-binary @sample-16k-mono.wav
```

## Migration and rollback

部署 Next.js 前先部署并通过 `/healthz`；回滚时删除 Vercel 的 `ASR_SERVICE_URL`/`ASR_SERVICE_TOKEN`，即可恢复百炼，不需要数据库操作。

## Contract tests

`tests/ai-transcription.test.ts` 覆盖请求头、成功响应、无效响应、超时和 fallback；FunASR 服务部署后再用短 WAV 做黑盒检查。
