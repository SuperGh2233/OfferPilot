# REQ/PLAN: 移除内置语音，使用系统听写

## Problem and business outcome

2026-10-08 用户明确要求删除 OfferPilot 内置语音功能，改用 macOS 听写。使用标准文本框接收输入即可，省去浏览器录音权限、音频转换、转写请求和独立模型服务。

## Users and workflow

用户在八股 Recall、模拟面试主问题或追问的文本框中输入文字，也可使用系统听写。文字按原有提交、评分和存储流程处理。

## Scope

- 移除三处 VoiceAnswerButton、录音忙碌状态及相关提交限制。
- 删除 `/api/ai/transcribe`、转写 provider、WAV 工具及专属测试。
- 删除 `asr-service/` 的 FastAPI/FunASR 源码、容器和依赖配置。
- 清理 Smoke 清单、环境变量示例、README 和当前开发说明。
- 更新已有 ASR 架构、接口和运维文档为历史参考，停止把 FunASR 部署列作当前待办。

## Non-goals

- 不修改 macOS 设置，不接入新的录音或语音 SDK。
- 不修改题库、Attempt、Mastery、daily task、复习日期或数据库结构。
- 不更改现有 AI 评分、理解教练、面试追问/总结及它们的保护机制。
- 不部署生产、不修改远端密钥或外部服务。

## Current evidence and constraints

- 内置录音在 KnowledgeTraining、InterviewSimulator 和 AiInterviewFollowUpPanel 三处使用，回答内容最终仍为普通字符串。
- 专属转写 API 和 WAV 工具没有其他产品调用方；Python 依赖全部位于独立 `asr-service/`。
- 项目要求 Node.js >=22.13；修改后需通过 lint、typecheck、test、build。
- 用户本轮明确要求删除功能，此请求作为当前路线优先事项；原有迁移与真实账号发布门槛继续保留。

## Data/API/state contracts

移除 Next.js `/api/ai/transcribe` Route Handler，不保留兼容转写接口。普通文本及系统听写生成的文本继续走已有 Learn/Recall 或面试链路。历史记录没有音频字段，删除功能无需数据迁移。详情见已退役的 ASR SPEC 历史文档。

## Implementation plan

- [x] 删除三处 UI 入口及仅用于录音的状态，保留保存/重复提交保护。
- [x] 删除转写路由、provider、WAV 工具、FunASR 服务及专属测试，更新 Smoke 回归。
- [x] 同步 README、环境变量示例、AGENTS、PLAN 和 ASR 文档生命周期。
- [x] 运行完整质量门与 diff 检查，确认构建路由不再包含转写 API。
- [x] 本地 Demo 验证文本 Recall、模拟面试主回答/追问和已移除接口。

## Risks and rollback

删除语音忙碌状态时不能误删保存锁或主问题/追问防重复提交锁。保留历史文本和训练记录。若需恢复，可从 Git 历史还原语音相关源码；无需数据库回滚。

## Acceptance criteria

- 三处回答界面没有内置录音入口，文本框可输入、粘贴和提交。
- 项目可执行代码不再调用麦克风、音频编码或转写服务。
- 不再生成 `/api/ai/transcribe` 路由；其专属配置和部署目录已移除。
- 原有文本评分、保存、AI fallback 和面试零训练写入规则继续通过回归。
- lint、typecheck、test、build 和 `git diff --check` 全部通过。

## Verification evidence

- 状态：本地源码完成，生产未部署。
- 本机 Node 26.10.0 满足项目 >=22.13.0；lint、typecheck、test、build 全部通过，44 个测试文件、394 项测试、242 个页面；`git diff --check` 通过。
- 首轮 typecheck 的失败源于旧 `.next/dev/types/validator.ts` 仍引用已删除路由，启动本地 Demo 重建开发路由类型后通过。
- 可执行源码没有录音/ASR 调用，构建清单没有 `/api/ai/transcribe`；本地 POST 返回 404。
- 隔离浏览器 Demo（3001，关闭 AI key）：Learn 自评保存、文本 Recall 提交、AI 未配置时确定性 fallback 正常；刷新后 Learn=1、Recall=1、Mastery 与复习日期保持。
- 模拟面试：文本主回答进入 fallback 追问，追问文本提交后进入第 2 题；随后 Knowledge 学习计数仍为 0，面试没有生成学习记录。
- UI 截图保存为本会话本地预览产物，未写入题库或业务数据。

## Status and next action

Status: completed（本地移除完成）。保留当前文件路径以保持已有文档链接稳定。下一步是项目既有迁移与真实账号发布验收；本轮未部署生产，未修改 macOS 设置或远端密钥。

## Revision record

- 2026-10-07：原计划为 FunASR 优先、百炼降级的语音稳定性改造，本地质量门通过，外部部署未验收。
- 2026-10-08：用户要求使用 macOS 听写，原语音部署任务取消；沿用本文件作为移除计划，避免维护两份相反的有效方案。
