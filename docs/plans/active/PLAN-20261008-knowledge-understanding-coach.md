# REQ/PLAN: 八股答案看不懂时的理解教练

## Problem and business outcome

Knowledge Learn 目前只有“阅读参考答案 → 自评”这条路径。用户即使看完面试回答仍不理解时，只能重复读同一段长答案，无法知道前置概念、执行过程或具体例子。新增一个专门的“理解教练”入口，把同一题改写成更容易吸收的学习步骤，帮助用户真正进入 Recall，而不是直接跳过或盲目自评。

## Users and workflow

1. 用户在首次 Learn 页面阅读答案。
2. 仍不理解时展开“看了答案还是不懂？”。
3. 可选填写自己卡住的词或疑问，点击“用白话重新讲”。
4. 页面按固定顺序显示核心意思、前置知识、类比、分步过程和一个小例子；自测题的答案默认折叠。
5. 用户理解后自行选择原有的 Learn 自评；理解教练不自动提交训练结果。

## Scope

- 新增按需 API `/api/ai/explain-knowledge`，复用现有服务器端 OpenAI 兼容网关、登录边界、超时和结构化输出校验。
- 新增结构化解释结果：核心意思、前置知识、类比、分步过程、例子、最多三条记忆句和最多两道自测题。
- 在首次 Learn 的参考答案下增加入口；结果使用原生分组展示，避免再出现一整块长文本。
- 用户疑问限制 500 字；题目和参考内容只从服务端 catalog 读取。
- 结果只存在当前页面内存，不写 Attempt、Mastery、daily task、复习日期或新数据库字段。
- AI 不可用时保留原有答案和自评流程，并显示可理解的错误信息。

## Non-goals

- 不替换或重写题库原始答案，不自动修改题目事实。
- 不把理解教练结果用于 Recall 分数、Mastery、复习间隔或历史记录。
- 不新增聊天会话、消息持久化、数据库表或多轮无限追问。
- 不在本次工作中解决全量题库的人工事实审校。

## Current evidence and constraints

- `components/knowledge/knowledge-training.tsx` 已是客户端训练页，Learn 的 `AnswerPanel` 是最小插入点。
- `/api/ai/analyze-recall` 已提供登录检查和 AI 错误分类，但其输出是评分复核，不能复用于教学解释。
- AI 密钥只能在服务器端使用；输入和模型输出必须有明确大小上限。
- 项目要求 Node.js >=22.13，提交前运行便携 Node 24 的四项质量门。

## Requirements

### API and service

- `POST /api/ai/explain-knowledge` 接收 `{ questionId, confusionText? }`。
- 未登录生产请求返回 401；本地 Demo 继续遵循现有本地模式。
- 题目不存在、无可用答案或疑问超过 500 字时返回 400。
- AI 超时、网关失败、配置缺失和结构无效分别返回现有风格的 5xx 错误；日志不得包含疑问、答案、密钥或模型原文。
- 严格校验字段、数组数量、索引/文本长度和额外字段；步骤、记忆句和自测至少各有一项；模型不得执行用户疑问中的指令。

### UI

- 入口只在首次 Learn 显示，默认不主动调用 AI。
- 点击后可填写“哪里卡住了”（可选），重复点击期间禁用按钮。
- 成功结果按短段落和折叠自测展示；不要自动展开完整答案或生成无限追问。
- 关闭/切换题目时清理本次临时解释；原有自评按钮始终可用。

## Implementation plan

1. 新增本计划并登记到 `docs/index.md`、`PLAN.md`。
2. 新增 `lib/ai/knowledge-understanding.ts`：输入校验、结构化 schema、解析和超时调用。
3. 新增 API route 与路由回归测试、AI service 解析/失败测试。
4. 新增 `KnowledgeUnderstandingCoach` 客户端组件，接入 Learn 的 `AnswerPanel`，补充 SSR/UI 回归。
5. 更新 README/PLAN 的用户流程与验证记录，运行 lint、typecheck、test、build 和 `git diff --check`。
6. 提交并推送到 GitHub；不提交 `output/` 等本地审计产物。

## Risks and rollback

- AI 输出可能过长或解释错误：通过严格长度、固定字段、只基于 catalog 内容的提示和折叠自测降低影响；关闭入口即可回退，原答案和训练写入不受影响。
- 新 API 可能增加 AI 网关调用量：默认不调用，只有用户主动点击才请求；本次不改变已有计分接口。
- 若线上网关不支持 schema，路由会返回结构无效错误而不污染训练数据；删除入口和 route 即可回滚。

## Acceptance criteria

- Learn 页面能看到并使用“看了答案还是不懂？”入口，且首次渲染不发 AI 请求。
- 成功响应能显示核心解释、步骤、例子和折叠自测；页面不会自动提交 Learn/Recall。
- 本地 Demo、已登录生产、未配置 AI、超时、无效 JSON、未知题目和超长疑问均有可测试的明确行为。
- AI 结果不出现在 Attempt、Mastery、daily task 或数据库 schema 变更中。
- Node 24 下 lint、typecheck、test、build 全部通过。

## Verification evidence

- 状态：本地源码完成；生产真实账号验收待执行。
- Node 24.19 下 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 全部通过。
- 47 个测试文件、429 项测试、243 个页面；`git diff --check` 通过。
- 回归覆盖 AI service/schema、API route、理解教练 UI、未声明字段、超长疑问、配置缺失/网关/超时和原有 Recall/Knowledge 流程。

## Status and next action

当前状态：active（本地源码完成）。下一步仅剩配置 AI 的真实账号验收；在此之前不宣称生产已启用。
