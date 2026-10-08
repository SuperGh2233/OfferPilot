# Runbook: FunASR 服务

> archived，2026-10-08：用户改用系统听写，内置录音/转写接口、FunASR 服务和专属测试已移除。下文仅保留历史契约与部署记录，不再作为当前操作指引。当前方案见 [移除计划](../plans/active/PLAN-20261007-speech-stability.md)。

## Preconditions and access

- 一台能运行 Docker 的独立主机或容器平台；CPU 可运行但首次加载较慢，GPU 可降低延迟。
- 设置随机高熵 `FUNASR_SHARED_TOKEN`，并在 Vercel 只设置对应的 `ASR_SERVICE_TOKEN`。
- 服务与 Vercel 之间使用 HTTPS；不要把服务令牌写进客户端变量。

## Normal procedure

```bash
cd asr-service
docker build -t offerpilot-funasr .
docker run --rm -p 8000:8000 \
  -e FUNASR_SHARED_TOKEN="$FUNASR_SHARED_TOKEN" \
  -e FUNASR_MODEL=paraformer-zh-streaming \
  offerpilot-funasr
```

本地临时调试且不想配置令牌时，必须显式增加 `-e FUNASR_ALLOW_ANONYMOUS=true`；生产环境不要设置这个变量。

在 Vercel Production 配置：

```text
ASR_SERVICE_URL=https://asr.example.com
ASR_SERVICE_TOKEN=<同一个令牌>
```

## Health verification

```bash
curl -fsS https://asr.example.com/healthz
curl -i -X POST https://asr.example.com/transcribe \
  -H "Authorization: Bearer $ASR_SERVICE_TOKEN" \
  -H "Content-Type: audio/wav" \
  --data-binary @sample-16k-mono.wav
```

期望健康检查为 200，转写响应只包含 `text` 和 `provider`。在 Vercel 完成登录态 Recall/Interview 语音回归后再宣布启用。

## Failure diagnosis

- `/healthz` 为 503：查看模型下载、内存和容器启动日志；确认模型已加载后再接入 Vercel。
- Vercel 日志显示 `provider=funasr fallback=true`：检查 HTTPS、令牌、服务区域和容器健康；百炼回退仍应可用。
- 两者都失败：暂时删除 `ASR_SERVICE_URL`，只保留百炼，确认页面恢复后再修 ASR。

日志只允许包含 provider、fallback、状态和耗时；发现音频、base64 或 Authorization 后立即停止采集并清理日志。

## Rollback

在 Vercel 删除 `ASR_SERVICE_URL` 与 `ASR_SERVICE_TOKEN` 并重新部署；保留百炼环境变量。ASR 容器可停止，不涉及 Supabase 数据。

## Backup and recovery

服务不持久化音频和业务数据，无需音频备份。只备份部署配置中的模型版本和镜像标签，不备份令牌到仓库。

## Logs and observability

关注 `/healthz` 可用率、FunASR 成功率、fallback 次数和请求耗时 p50/p95。Vercel 日志不要打印请求体或异常对象。

## Escalation conditions

连续健康检查失败、p95 超过百炼回退耗时、内存持续增长或中文短音频明显错误时，先回退百炼，再重新评估模型/硬件/区域。
