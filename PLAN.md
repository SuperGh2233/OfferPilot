# OfferPilot 实施计划

> 本文件是后续开发的执行基准。每次开始开发前先阅读本文件；每次修改代码后，必须在同一轮更新这里的进度、验证结果和变更记录。

## 当前状态

- 最后更新：2026-09-13
- 当前阶段：Phase 8 — 完善、真实 Supabase、部署（进行中）
- 当前任务：Phase 8.5 提交并部署 Hot 100 静态题面与 Java 初始代码，然后继续稳定域名生产 Smoke
- 已完成：Phase 0、Phase 1 本地版本、Phase 2、Phase 3、Phase 4、Phase 5、Phase 6、Phase 7
- 本地运行：`http://localhost:3000`；已切换真实 Supabase 模式，本地 SQLite 文件保留
- 云端状态：Supabase Migration、两次 Seed、精确目录和双用户 RLS 验证通过；AI 三项服务端变量已配置；算法计时页 Java 编辑区已由 Git 集成自动部署为 READY，真实登录与训练验收进行中
- 最近质量门：Node 24 下 `lint`、`typecheck`、`test`、`build` 全部通过；28 个测试文件、259 项测试通过，生成 238 个页面

| 阶段 | 状态 | 核心结果 |
| --- | --- | --- |
| Phase 0 | 已完成 | 需求、架构、ER、数据和风险决策完成 |
| Phase 1 | 本地完成 | Next.js、Auth 代码、Migration、Seed、本地 Demo |
| Phase 2 | 已完成 | 评分、Mastery、Attempt、Planner 与 7 天模拟通过 |
| Phase 3 | 已完成 | Hot 100 列表、筛选、计时反馈与本地复习闭环 |
| Phase 4 | 已完成 | 八股匹配、掌握度、Topic 聚合和每日 Planner |
| Phase 5 | 已完成 | 八股学习、主动回忆、反馈与复习状态闭环 |
| Phase 6 | 已完成 | Dashboard、Progress、Settings 与周期边界闭环 |
| Phase 7 | 已完成 | 可选 AI Java 代码分析、严格响应与失败降级闭环 |
| Phase 8 | 进行中 | 本地 SQLite 日常使用已就绪；Supabase 与 Vercel 已部署，生产登录、训练和 AI Recall Smoke 待最终验收 |

## 计划维护规则

每次开发必须遵循以下顺序：

1. 阅读 `PLAN.md`，只选择当前 Phase 中边界清晰的一组任务。
2. 在“当前状态”中写明正在执行的任务；不得跨 Phase 偷跑功能。
3. 修改实现与测试，保留用户已有数据和无关改动。
4. 代码修改后运行与风险相称的检查；阶段结束必须运行完整质量门。
5. 在同一轮代码修改中同步更新：任务复选框、当前任务、最后更新日期、验证结果和变更记录。
6. 只有实现、测试和验收条件都满足时才能勾选完成；失败项必须保持未完成并记录原因。
7. 如果需求发生变化，先更新“已确认决策”和对应阶段，再修改代码。

阶段完整质量门：

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

## 已确认决策

- 42 天是第一训练周期，不是产品生命周期上限；周期后仍继续复习。
- 算法范围只包含力扣官方 LeetCode Hot 100 静态快照，不做运行时抓取。
- 八股完整保存 165 个 Topic、394 道主问题、510 道追问，共 904 道题。
- 默认六周新知识只从 120 道 `is_core_6weeks = true` 的主问题中生成。
- follow-up 只挂在主问题下，默认不占每日新题额度。
- mastery 只由确定性 TypeScript 规则更新；AI 分析不得直接修改 mastery。
- 八股 Recall 保留确定性关键词分数，并允许用户提交后主动请求 AI 语义复核；AI 结果只用于解释，不回写 mastery。
- 算法 AI 代码复盘同时提取本题代码实际涉及的 Java 基础方法，展示用途、语法、示例和易错点；复用现有复盘请求与持久化，不建立独立课程模块。
- 算法训练页使用随 Hot 100 快照保存的静态题面与 Java 初始代码；已有草稿优先且不得被模板覆盖，不引入运行时抓取或在线判题。
- Hard 时间修正采用 `<=40/+5`、`<=60/0`、`<=90/-5`、`>90/-10`，避免过度惩罚。
- 算法失败时取“平滑 mastery”和“旧 mastery−15”的较低值，确保失败至少下降 15。
- V1 不建独立 weakness 表；从 `mistake_tags` 和可选 `ai_analysis` 聚合。
- 八股 Seed 默认第一个 key point 权重为 20，其余为 5；Phase 4 必须验证并记录该实现假设。
- Recall coverage 分档边界采用 `<=20 / <=40 / <=60 / <80 / >=80`；7 天后 coverage ≥80% 的 retention 证据将 mastery 保底到 90。
- Knowledge 复习间隔按 mastery 使用 1 / 2 / 3 / 5 / 7 / 14 / 21 天；Topic 聚合中 follow-up 权重为同 importance 主问题的 50%。
- Knowledge Planner 在 Week 5 默认调整为 1 新学 + 5 复习，Week 6 为 0 新学 + 6 复习；不足的到期复习不以未到期题补位。
- 2026-09-13 起逾期复习上浮：当天到期复习多于复习配额时，配额自动提升为配置数量的最多 3 倍（不超过实际逾期数，显式配 0 不上浮）；Dashboard 显示逾期复习与往日遗留任务欠账。
- 计划开始日期是遗留任务欠账的下边界；重设起点不会删除历史或掌握度，但新起点之前的未完成日任务不再计入当前计划欠账。
- 外部已完成算法题允许按题号、`[题号]题名` 或 LeetCode 链接批量导入；导入题以 60% 保守掌握度进入学习状态、3 天后复习，不伪造训练 Attempt，也不覆盖已有 OfferPilot 记录。
- 当前先运行本地 Demo，后续再连接 Supabase；前端目标部署平台仍为 Vercel。
- 2026-09-11 起本地阶段改用 Node 24 内置 SQLite 持久化单用户训练状态；复用同一领域规则与训练 API，后续部署时切换到 Supabase，不新增 ORM 或第二套 mastery/planner 逻辑。

## Phase 0 — 需求理解与架构

状态：已完成。

- [x] 检查空仓库、数据目录、README、Git 和 Supabase 状态。
- [x] 明确 V1 只包含 Algorithm、Knowledge、Dashboard、Progress、Settings。
- [x] 确认 ER 关系、掌握度引擎、Daily Planner 和 Phase 0–8 顺序。
- [x] 验证八股事实源：165 Topic、904 问题、120 核心主问题。
- [x] 获得制作官方 Hot 100 带日期静态快照的授权。
- [x] 确认 42 天为第一训练周期。
- [x] 完成 Git 仓库初始化。

验收：用户已确认架构建议和关键决策。

## Phase 1 — Next.js、Supabase 基础、Auth、Migration、Seed

状态：本地完成；云端应用延后至 Phase 8。

- [x] 创建 Next.js 16 App Router、React、TypeScript strict 工程。
- [x] 接入 Tailwind CSS、shadcn/ui、Supabase SSR 客户端。
- [x] 实现邮箱密码登录、注册、邮箱确认、退出和受保护路由代码。
- [x] 创建 9 张核心表、PK/FK/Unique/Index、Trigger 和 RLS Migration。
- [x] 创建官方 Hot 100 静态快照：100 道，日期 2026-09-08。
- [x] 原样复制 8 个八股数据文件到 `data/knowledge/`，哈希一致。
- [x] 实现幂等 Seed，主问题先于 follow-up 导入。
- [x] 标记 120 道核心主问题并保留全部原始字段和父子关系。
- [x] 提供 `.env.example`、数据库 TypeScript 类型和 README。
- [x] 增加仅开发环境可用的本地 Demo 模式；生产环境不能绕过认证。
- [x] 本地 `/`、`/login`、`/dashboard` 返回 200，Dashboard 可见。
- [ ] 在真实 Supabase 项目执行 Migration、Seed 和 Auth 联调（按决定延后至 Phase 8）。
- [ ] 在真实 Supabase 连续执行两次 Seed，验证不会产生重复数据（延后至 Phase 8）。
- [ ] 使用两个真实用户验证 RLS 数据隔离（延后至 Phase 8）。

验收记录：`lint`、`typecheck`、`test`、`build` 通过；数据校验为 100 / 165 / 904 / 120。

## Phase 2 — Algorithm Backend

状态：已完成。

### 2.1 规则与领域类型

- [x] 定义算法难度、结果、独立性、错误标签和状态类型。
- [x] 实现 `calculateAlgorithmAttemptScore()` 纯函数。
- [x] 实现 Easy、Medium 和不过度惩罚的 Hard 时间修正。
- [x] 实现 WA 修正并将得分限制在 0–100。
- [x] 为所有规则边界编写表驱动测试。

### 2.2 Mastery 与复习

- [x] 实现首次 mastery 和 `old * 0.4 + score * 0.6` 平滑更新。
- [x] 实现间隔 3 天 / 7 天的独立 AC 奖励。
- [x] 设计并测试 failed 对高 mastery 的明确下降规则，避免“失败仍虚高”。
- [x] 实现 `<40 / 40–59 / 60–74 / 75–84 / 85–91 / >=92` 复习间隔。
- [x] 实现 mastered 判定：mastery ≥ 85、至少两次 attempt、存在间隔 ≥3 天独立 AC。

### 2.3 Attempt 与 Daily Planner

- [x] 实现开始训练、结束训练和保存反馈的服务层。
- [x] 实现 `generateDailyAlgorithmTasks()`，不把业务逻辑塞进组件。
- [x] 每日默认 2 道新题 + 1 道复习题，并允许 Profile 配置覆盖。
- [x] 优先级：到期复习 > 薄弱类别关联题 > 当前 Week 新题。
- [x] 多个到期题按 mastery 最低、overdue 最久排序。
- [x] 保证同一天重复生成不会产生重复任务。
- [x] 聚合用户与 AI 的 weakness tags，但不直接影响 mastery。
- [x] 显式实现 Week 4 复习优先、Week 5 复习 70%/未完成题 30%、Week 6 不强推新题。
- [x] Hot 100 importance 相同时使用官方 `order_index`，不凭空制造权重。

### 2.4 Phase 2 验收

- [x] 覆盖 score、mastery、review interval、failed 二刷和幂等测试。
- [x] 模拟连续训练 7 天，验证 mastery、next review 和到期重入。
- [x] 运行完整质量门并记录结果。

## Phase 3 — Algorithm UI 完整闭环

状态：已完成。

- [x] 实现 `/algorithm` Hot 100 列表。
- [x] 支持 All、Today、Review Due、Unlearned、Mastered、Weak 筛选。
- [x] 支持按算法标签筛选，并展示难度、mastery、attempt count、next review。
- [x] 实现 `/algorithm/[id]` 训练页、当前刷次和 mastery 展示。
- [x] 实现开始计时、打开 LeetCode、结束训练流程。
- [x] 实现约 10 秒可完成的 result、independence、WA 和 mistake tags 反馈。
- [x] Java 代码粘贴保持可选，不在本阶段自动调用 AI。
- [x] 验证 attempt → score → mastery → next review → 到期重入完整闭环。
- [x] 运行完整质量门并记录结果。

## Phase 4 — Knowledge Backend

状态：已完成。

### 4.1 关键词覆盖

- [x] 实现 `normalizeChineseText()`，处理大小写、空格和标点。
- [x] 实现 `matchKnowledgeKeyPoints()`，支持 `key_points + keyword_aliases`。
- [x] 为无 aliases、无 key point 的题目定义确定性降级行为。
- [x] 使用关键点权重计算 coverage，而不是简单计数。
- [x] 输出稳定、可解释的 matched points 和 missing points。

### 4.2 Mastery 与 Topic 聚合

- [x] 实现首次 Learn 自评到 15 / 30 / 45 / 55 mastery 的映射。
- [x] 实现 Recall coverage 到 25 / 40 / 55 / 70 / 85 attempt score 的映射。
- [x] 实现平滑 mastery 更新和 7 天高覆盖 retention bonus。
- [x] 实现 mastered 判定：mastery ≥ 85 且至少完成一次 recall。
- [x] 实现按 importance 加权的 Topic mastery，降低 follow-up 权重。

### 4.3 Knowledge Planner 与验收

- [x] 实现 `generateDailyKnowledgeTasks()` 和总 `generateDailyTasks()`。
- [x] 每日默认 3 个核心主问题新知识 + 3 个到期复习。
- [x] 优先级：overdue review > low mastery core > current week core。
- [x] follow-up 不得作为默认新题，可作为详情扩展或 optional deep dive。
- [x] 测试规范化、别名、加权 coverage、mastery、Topic 聚合、优先级和幂等。
- [x] 模拟连续 7 天学习与回忆并运行完整质量门。

## Phase 5 — Knowledge UI 完整闭环

状态：已完成。

- [x] 实现 `/knowledge` 分类、Topic mastery、学习进度和待复习数。
- [x] 实现 `/knowledge/[id]` 首次 Learn 模式。
- [x] 展示问题、一句话答案、面试答案、完整答案、关键点和来源。
- [x] 实现后续 Recall 模式，提交前默认隐藏答案。
- [x] 支持“提交回忆”和“想不起来”。
- [x] 提交后展示 matched / missing，再允许查看答案。
- [x] follow-up 在主问题详情下折叠展示，不占默认新题额度。
- [x] 验证 Learn → 到期 → Recall → 匹配 → mastery → next review 完整闭环。
- [x] 运行完整质量门并记录结果。

## Phase 6 — Dashboard、Progress、Settings

状态：已完成。

- [x] Dashboard 展示 Day X / 42、Week、本周完成率和连续训练天数。
- [x] 展示今日 Algorithm 新题/复习、Knowledge 学习/复习及剩余任务数。
- [x] 展示 Algorithm 和 Knowledge 薄弱项 Top 3–5。
- [x] Progress 展示第一周期整体完成率。
- [x] 展示 Hot 100 与核心 120 的已学习、已掌握、待复习、未学习。
- [x] 展示算法分类 mastery、八股分类 mastery 和薄弱 Topic Top 10。
- [x] 实现 `/settings`：显示名、时区、计划开始日期和四个每日任务数量配置。
- [x] 验证 Day 1、Day 42、Day 43；Day 42 后继续生成到期复习。
- [x] 保持首页信息克制，不加入排行榜、金币或复杂图表。
- [x] 运行完整质量门并记录结果。

## Phase 7 — AI Algorithm Code Analysis

状态：已完成。

- [x] 安装并配置 OpenAI SDK，支持 API Key、Base URL 和 Model。
- [x] 仅当代码非空且用户主动点击“AI 分析代码”时调用模型。
- [x] 使用严格结构化 JSON Schema 校验响应。
- [x] 返回 solution type、复杂度、summary、mistakes、weakness tags、good points。
- [x] 优先理解用户原思路并给出最小修改，不默认重写整个解法。
- [x] AI 结果只用于解释与弱项统计，绝不直接修改 mastery。
- [x] 覆盖空代码、无效响应、网关失败和超时处理。
- [x] 使用 mock 测试，测试和构建不依赖真实 API Key。
- [x] 运行完整质量门并记录结果。

## Phase 8 — 完善、真实 Supabase、部署

状态：进行中。

- [x] 完成全局导航、Dark Mode 和响应式布局。
- [x] 统一绿/黄/红/灰的已掌握、待复习、薄弱、未学习状态语义。
- [x] 桌面重点优化算法训练；手机重点优化 Dashboard、八股复习、Progress。
- [x] 补齐 loading、empty、error、not found、表单反馈和可访问性。
- [x] 完成真实 Supabase 训练适配、认证 Route Handler、事务写入、并发/跨午夜保护和历史分页，并通过本地质量门。
- [x] 接入本地 SQLite 持久数据库，迁移现有浏览器 Demo 数据并跑通训练闭环。
- [x] 创建真实 Supabase 项目并填写本地安全环境变量。
- [x] 执行 Migration、Seed，验证 100 / 165 / 904 / 120 数据。
- [x] 连续执行两次 Seed 并验证幂等，使用两个用户验证 RLS 隔离。
- [ ] 关闭 `LOCAL_DEMO_MODE`，联调真实注册、邮箱确认、登录、退出和 RLS 隔离。
- [x] 在 Vercel 配置生产环境变量并部署 Next.js 前端。
- [x] 支持批量导入外部已完成的 Hot 100 题目，并在本地数据库与 Supabase 共用同一语义。
- [x] 接入 OpenAI 兼容的八股 Recall AI 语义复核，服务端读取题库、严格校验结构化结果且不修改 mastery。
- [x] 优化算法写题流程：未提交代码草稿自动恢复，训练记录先保存，AI 复盘后执行并独立持久化。
- [x] 支持取消尚未完成的算法训练，不改变历史成绩与 Mastery，并恢复对应待办状态。
- [x] 支持计时期间在训练页直接编写 Java 代码，刷新恢复并自动带入反馈。
- [x] 为全部 Hot 100 训练页展示静态题面并在新 Attempt 自动填入 Java 初始代码，支持确认后恢复模板且保护已有草稿。
- [ ] 完成生产 Smoke Test、README 和恢复/排错说明。（脚本与文档已完成，待真实生产执行）
- [ ] 运行完整质量门并完成 V1 最终验收。

## V1 最终验收

- [x] Algorithm 完整闭环：开始 → 计时 → 反馈 → score → mastery → next review → 到期重入 → 二刷更新。（本地 Demo 已验收）
- [x] Knowledge 完整闭环：Learn → 初始 mastery → 到期 → Recall → matched/missing → mastery → next review。（本地 Demo 已验收）
- [x] 连续模拟 7 天，能够区分已掌握、假会、薄弱类型和到期任务。（确定性测试已验收）
- [x] 同日重复生成 Daily Tasks 不重复。（本地存储与云端唯一约束/事务契约已验收）
- [x] 每个用户只能访问自己的 profile、attempt、state 和 task。（真实双用户远端验证通过）
- [x] 公共题库只允许 authenticated read。（真实匿名/认证远端验证通过）
- [ ] 本地和生产均通过完整质量门。

## 明确不做

- 岗位抓取、投递管理、面试管理。
- BOSS、智联、51Job、Chrome/IDEA 插件、LeetCode 自动同步。
- 语音口试、社交、排行榜、金币等游戏化功能。
- Agent 工作流、LangChain、LangGraph、RAG。
- 微服务、Kafka、Redis。
- 剑指 Offer、CodeTop、公司专项题或额外算法题库。

## 变更记录

| 日期 | 阶段 | 变更 | 验证 |
| --- | --- | --- | --- |
| 2026-09-08 | Phase 0 | 完成需求、架构、数据与 42 天周期决策 | 用户确认 |
| 2026-09-08 | Phase 1 | 完成 Next.js、Auth 代码、Migration、静态快照、八股 Seed 与类型 | lint/typecheck/test/build 通过 |
| 2026-09-08 | Phase 1 | 增加仅开发环境生效的本地 Demo 模式并启动服务 | `/`、`/login`、`/dashboard` 为 200；3 项测试通过 |
| 2026-09-09 | 计划 | 创建长期实施计划并加入强制同步更新规则，下一任务设为 Phase 2.1 | Luna 需求复核与人工核对 |
| 2026-09-09 | Phase 2.1 | 开始算法规则、领域类型与表驱动测试 | 进行中 |
| 2026-09-09 | Phase 2.1 | 完成算法 Attempt Score、三种难度时间规则、WA 修正、输入校验与边界测试 | lint/typecheck/test/build 通过；33 项测试通过 |
| 2026-09-09 | Phase 2.2 | 开始 Mastery、失败惩罚、复习间隔与 Mastered 判定 | 进行中 |
| 2026-09-09 | Phase 2.2 | 完成 Mastery 平滑更新、3/7 天奖励、失败下调、复习间隔与 Mastered 判定 | lint/typecheck/test/build 通过；71 项测试通过 |
| 2026-09-09 | Phase 2.3 | 开始 Attempt 生命周期、Daily Algorithm Planner 与弱项聚合 | 进行中 |
| 2026-09-09 | Phase 2.3 | 完成 Attempt 领域服务、幂等 Daily Planner、Week 4–6 配额和弱项聚合 | lint/typecheck/test/build 通过；106 项测试通过 |
| 2026-09-09 | Phase 2.4 | 完成连续 7 天算法模拟与 Phase 2 验收 | lint/typecheck/test/build 通过；108 项测试通过 |
| 2026-09-09 | Phase 3 | 开始本地 Algorithm 列表、筛选与训练闭环 | 进行中 |
| 2026-09-09 | Phase 3.1 | 增加 Hot 100 前端目录映射、稳定题目 ID、标签索引与 Planner 转换；修正 Vitest 的相对导入 | 目录测试 2 项、typecheck、lint 通过 |
| 2026-09-09 | Phase 3.2–3.3 | 增加 `/algorithm/[id]` 静态详情页与本地训练闭环 UI：计时恢复、LeetCode 新页、反馈、可选 Java 代码、完成结果与只读云端提示；统一跨页本地更新事件并修正 React effect lint 约束 | lint/typecheck/test/build 通过；116 项测试通过（并行执行时 typecheck 曾受 `.next` 生成竞态影响，串行复核已通过） |
| 2026-09-09 | Phase 3.1 | 增加版本化 localStorage 适配层：Asia/Shanghai 日期任务缓存、42 天周次、尝试恢复与完成反馈闭环，并覆盖损坏数据恢复与序列化测试 | `npm run lint`、`npm run typecheck`、目标测试通过；6 项测试通过 |
| 2026-09-09 | Phase 3.1 | 完成 `/algorithm` Hot 100 列表、本地 Demo 状态概览、六种状态筛选、单标签筛选、响应式卡片与训练详情链接；非 Demo 模式保持只读题库 | `npm run lint`、`npm run typecheck`、`npm run build` 通过；训练闭环待 `/algorithm/[id]` 汇合 |
| 2026-09-09 | Phase 3.4 | 浏览器完成列表筛选、计时刷新恢复、快速反馈和状态回写验收；修正首次高分被误标为 mastered，并更新 Dashboard 训练入口 | 完整质量门待运行 |
| 2026-09-09 | Phase 3.4 | 完成 Phase 3 质量门与本地页面验收，进入 Knowledge Backend | lint/typecheck/test/build 通过；116 项测试，100 个详情静态路由生成 |
| 2026-09-09 | Phase 4.1 | 完成八股文本 NFKC/大小写/空格/标点规范化、按权重关键点匹配、精确或唯一可归属别名与无 key point 确定性降级 | 9 项匹配测试、typecheck、lint 通过 |
| 2026-09-09 | Phase 4.2 | 完成 Learn 自评、Recall coverage 分数、平滑更新、7 天 retention、复习间隔、mastered 与 Topic 加权聚合 | 25 项 mastery 测试、typecheck、lint 通过 |
| 2026-09-09 | Phase 4.2 | 增加完整 165 Topic / 904 Question 本地目录和 120 核心主问题映射，并把 20/5 key point 权重落实到可复用事实源；收窄 JSON union 别名类型 | 4 项目录测试、seed:check、typecheck、lint 通过 |
| 2026-09-09 | Phase 4.3 | 实现 Knowledge Planner 与 Algorithm/Knowledge 总 Planner：默认 3+3、到期/低 mastery/current week 优先、幂等、follow-up 新题排除和 Week 5–6 复习策略 | 8 项 Planner 测试通过 |
| 2026-09-09 | Phase 4.2 | 增加 Learn/Recall Attempt 领域服务，复用匹配和 mastery 规则生成可持久化 attempt/state，并支持“想不起来”零覆盖路径 | 6 项 Attempt 测试、typecheck、lint 通过 |
| 2026-09-09 | Phase 4.3 | 完成固定 UTC 的连续 7 天 Knowledge 学习/回忆模拟，覆盖零覆盖降级、到期重入、每日幂等和 Topic mastery 变化；完成 Phase 4 质量门 | lint/typecheck/test/build 通过；14 个文件、169 项测试通过 |
| 2026-09-11 | Phase 8 | 统一本地 Demo 与云端完成语义：一次训练会完成同一题的全部未结任务，同时保留已完成历史 | 2 个目标测试文件、14 项测试、typecheck、lint 通过 |
| 2026-09-11 | Phase 8 | 把 7 天八股验收扩展到真实题库的 HashMap、线程池、JVM、MySQL、Redis 五个目标 Topic | 2 项回放测试、typecheck、lint 通过 |
| 2026-09-11 | Phase 8 | 增加 Supabase 训练适配器行为回归：1001 条历史分页、确定性今日任务写入、错误题库 ID 拒绝 | 9 项适配器测试、typecheck、lint 通过 |
| 2026-09-11 | Phase 8 | 完成八股训练页暗色视觉验收并恢复原主题 | HashMap Learn 卡片、答案、侧栏均为暗色；浏览器无 error/warning |
| 2026-09-09 | Phase 5.1 | 增加 Knowledge 本地 Demo 存储：版本化恢复、日期/状态边界校验、每日任务缓存、Learn/Recall 持久化与任务完成状态 | 初版 3 项测试通过；加强损坏数据边界后待复测 |
| 2026-09-09 | Phase 5.1 | 增加 `/knowledge` 今日任务、分类切换、165 个 Topic mastery/学习进度/待复习概览与主问题入口；初次本地加载改为异步调度以满足 React effect 约束 | typecheck/build 通过，首次 lint 暴露 effect 约束，修正后待复测 |
| 2026-09-09 | Phase 5.2–5.3 | 增加 `/knowledge/[id]` Learn/Recall 页面、四档自评、隐藏答案主动回忆、想不起来、matched/missing、答案回看、折叠追问和 Dashboard 入口；内部返回改用 Next Link | typecheck/build 通过，清理 lint 导航警告后待复测 |
| 2026-09-09 | Phase 5.4 | 浏览器走通 Learn 自评、Recall 隐藏答案、零覆盖遗漏反馈、Mastery/复习日期与今日任务状态回写；分类顺序调整为六周教学顺序并默认显示 Java基础 | 浏览器闭环通过；分类修正后待复测与完整质量门 |
| 2026-09-09 | Phase 5.4 | 完成分类/Topic、Learn、Recall、matched/missing、答案回看、追问折叠与本地持久化验收，正式进入 Phase 6 | lint/typecheck/test/build 通过；15 个文件、172 项测试、230 个页面 |
| 2026-09-09 | Phase 6.1 | 根据 Luna 边界复核，将 Knowledge 复习日期展示统一到本地 Demo 的 Asia/Shanghai 计划时区，避免跨时区显示与任务日期错位 | lint/typecheck 通过 |
| 2026-09-09 | Phase 6.1 | 增加 Dashboard/Progress 共用的纯统计规则，覆盖 Day 1、Day 42、Day 43、当前周生成任务完成率与连续训练天数 | 6 项目标测试、lint、typecheck 通过 |
| 2026-09-09 | Phase 6.1 | Dashboard 接入 Algorithm/Knowledge 同源本地数据，展示 Day/42、Week、本周完成率、连续天数、今日新题/复习/剩余和两类薄弱项；统一算法跨页更新事件常量 | lint/typecheck 与 15 项相关测试通过；待浏览器验收 |
| 2026-09-09 | Phase 6.1 | 首轮静态检查发现算法训练页仍有两处旧事件常量引用并有一个未使用导入，已改为统一常量并清理 | 初次 lint 1 条 warning、typecheck 2 处错误；修正后 lint/typecheck 通过 |
| 2026-09-09 | Phase 6.1 | 浏览器确认 Day 1/42、本周 2/5、连续 1 天、今日两类任务剩余数和 Knowledge 薄弱 Topic 均与当前本地训练记录一致，控制台无错误 | Dashboard 浏览器验收通过；进入 Phase 6.2 |
| 2026-09-09 | Phase 6.2 | 增加目录进度与加权 mastery 纯函数，统一计算已学习、已掌握、待复习、未学习和分类掌握度 | 8 项目标测试、lint、typecheck 通过 |
| 2026-09-09 | Phase 6.2 | 新增 `/progress`：第一周期核心目标覆盖率、Hot 100/核心 120 四态统计、算法与八股分类 mastery、已训练薄弱 Topic Top 10，并从 Dashboard 提供入口 | lint/typecheck、8 项目标测试与浏览器验收通过；控制台无错误 |
| 2026-09-09 | Phase 6.3 | 新增与数据库 Profile 字段一致的版本化本地设置：显示名、五个常用时区、计划开始日期和四个 0–100 每日任务数量，损坏数据自动恢复 | 4 项 Profile 测试通过 |
| 2026-09-09 | Phase 6.3 | Algorithm 本地日期键、周期与损坏数据恢复增加可选 Profile 时区，默认仍为 Asia/Shanghai | 相关回归测试、lint、typecheck 通过 |
| 2026-09-09 | Phase 6.3 | Algorithm 每日 Planner 接受 Profile 新题/复习数量，开始与完成训练按配置时区更新当天任务 | 相关回归测试、lint、typecheck 通过 |
| 2026-09-09 | Phase 6.3 | Knowledge 本地日期、Planner 配额及 Learn/Recall 任务回写接入同一组 Profile 参数，默认行为不变 | 相关回归测试、lint、typecheck 通过 |
| 2026-09-09 | Phase 6.3 | Profile 初轮运行测试通过但 typecheck 发现内存存储桩的 `getItem` 签名过窄，已补齐标准 Storage 参数 | 13 项相关测试、lint、typecheck 通过 |
| 2026-09-09 | Phase 6.3 | 新增 `/settings` 本地 Profile 表单，使用原生 date/select/number 控件保存显示名、时区、计划起点与四个任务数量，并同步两套本地训练起点；Dashboard 增加入口 | lint/typecheck、相关测试和默认保存浏览器验收通过 |
| 2026-09-09 | Phase 6.3 | 首轮 Settings 检查通过 typecheck 与 13 项相关测试；清理 Profile 测试桩未使用参数 warning | 初次 lint 1 条 warning；修正后 lint 通过 |
| 2026-09-09 | Phase 6.3 | 周期进度、本周完成率与连续训练统计接受 Profile 时区，默认口径不变 | 统计回归测试通过 |
| 2026-09-09 | Phase 6.3 | Dashboard/Progress 读取本地 Profile：周期与连续天数按配置时区计算，Dashboard Planner 使用四项数量并显示可选显示名 | lint/typecheck 与相关测试通过；待浏览器复核 |
| 2026-09-09 | Phase 6.3 | Algorithm 列表的每日任务配额、日期边界与复习日期展示接入 Profile，并监听设置变更 | lint/typecheck 与相关测试通过 |
| 2026-09-09 | Phase 6.3 | Algorithm 训练页按 Profile 配额初始化任务，计时开始/完成与日期显示使用同一时区，并监听设置变更 | lint/typecheck 与相关测试通过 |
| 2026-09-09 | Phase 6.3 | Knowledge 列表的 Planner 配额、日期边界和复习日期展示接入 Profile，并监听设置变更 | lint/typecheck 与相关测试通过 |
| 2026-09-09 | Phase 6.3 | Knowledge 训练页按 Profile 配额生成任务，Learn/Recall 回写与日期显示使用同一时区，并监听设置变更 | lint/typecheck 与相关测试通过 |
| 2026-09-09 | Phase 6.3 | 增加自定义时区日期边界与 Algorithm/Knowledge 自定义 Planner 配额回归测试 | 23 项相关测试、lint、typecheck 通过 |
| 2026-09-09 | Phase 6.3 | 首轮 typecheck 发现 TopicCard 内错误引用父组件 snapshot，已改为显式传入时区属性 | 初次 typecheck 1 处错误；修正后通过 |
| 2026-09-09 | Phase 6.3 | Settings 浏览器保存默认值成功；开发热更新保留旧 Snapshot 时 Progress 曾读取不到新增 Profile，Dashboard/Progress 增加 Profile 加载保护 | 新标签复核 Dashboard/Progress 控制台无错误 |
| 2026-09-09 | Phase 6.3 | 临时显示名保存后 Dashboard 立即显示，随后清空恢复，证明 Profile 跨页事件与持久化生效 | 浏览器可逆验收通过；未改变现有训练计划 |
| 2026-09-09 | Phase 6.4 | 增加 Day 43 联合 Planner 验证：第一周期结束后 Algorithm/Knowledge 继续生成到期复习且不强推新题 | 9 项目标测试、lint、typecheck 通过 |
| 2026-09-09 | Phase 6.4 | 完成 Dashboard、Progress、Settings、Profile 时区/配额接线与周期边界验收，正式进入 Phase 7 | lint/typecheck/test/build 通过；17 个文件、187 项测试、232 个页面 |
| 2026-09-09 | Phase 7.1 | 按官方 Responses API 文档安装唯一新增依赖 `openai`，后续使用 `responses.create`、严格 JSON Schema 与 `output_text` | `npm install openai` 成功；待实现与验证 |
| 2026-09-09 | Phase 7.1 | 新增服务器端 OpenAI 配置、Responses API 服务、严格封闭 JSON Schema、二次运行时校验和 `/api/ai/analyze-code` 边界；默认模型为 `gpt-5.5`，密钥不暴露给客户端 | 目标测试待运行；下一步接入训练反馈 UI 与本地 attempt |
| 2026-09-09 | Phase 7.1 | Schema、空代码、缺少配置、无效响应、网关失败与超时首轮 mock 测试通过；将测试可注入环境收窄为三个 OpenAI 配置项 | 11 项目标测试通过；lint 通过；typecheck 首轮发现测试环境类型过宽，已修正待复核 |
| 2026-09-09 | Phase 7.2 | Algorithm 反馈页增加代码非空才可用的显式 AI 分析按钮、结构化复盘面板与 20000 字符边界；AI 结果随 attempt 本地保存并汇入弱项聚合 | 目标测试、静态检查与浏览器验收待运行 |
| 2026-09-09 | Phase 7.2 | Attempt 增加可选 `aiAnalysis`，旧本地数据保持兼容；AI 字段不进入 score/mastery/review 计算链，并增加不变量回归测试 | 目标测试待运行 |
| 2026-09-09 | Phase 7.2 | AI 服务、Attempt、Demo Store 与 Planner 相关 54 项测试通过；修正严格类型下 `ProcessEnv` 弱类型和只读测试夹具不匹配 | 54 项目标测试、lint、typecheck 通过 |
| 2026-09-09 | Phase 7.2 | Luna 完成 Phase 7 只读审查，确认无需数据库迁移；采纳旧数据兼容、编辑代码清空旧分析、AI 不阻塞反馈保存和服务端 SDK 边界建议 | 人工逐项核对完成；接口级与浏览器验收待执行 |
| 2026-09-09 | Phase 7.2 | 增加接口级输入边界测试与响应体容量上限；本地真实 Route 验证空代码/未知题目为 400、缺少服务器密钥为 503 | HTTP 手工验证通过；新增测试待运行 |
| 2026-09-09 | Phase 7.2 | 接口测试首轮发现 Vitest 未配置 Next `@/` 路径别名；未新增测试配置，改为 Route 内等价相对导入 | 其余 55 项目标测试、lint、typecheck 通过；接口测试待复核 |
| 2026-09-09 | Phase 7.2 | Route 测试二轮仍被未执行的 Supabase 服务端模块别名阻断；将该模块改为仅非 Demo 分支动态加载，减少本地路径耦合 | 其余 55 项目标测试、lint、typecheck 通过；接口测试待复核 |
| 2026-09-09 | Phase 7.2 | 接口 mock 与本地 Route 测试通过；浏览器验证空代码按钮禁用、非空后启用、缺少密钥错误可读，且 AI 失败不阻塞反馈保存 | 15 项 AI 测试通过；浏览器控制台无错误；完整质量门待运行 |
| 2026-09-09 | Phase 7.3 | 完成可选 AI Java 代码分析、严格结构化响应、服务端密钥边界、失败降级、Attempt 持久化与弱项统计，正式进入 Phase 8 | lint/typecheck/test/build 通过；19 个测试文件、202 项测试、233 个页面 |
| 2026-09-09 | Phase 8.1 | 新增全局五入口导航、当前页语义、无依赖的系统/手动 Dark Mode 与移动端横向导航；提取稳定训练状态色语义 | 4 项状态映射测试与浏览器验收待运行 |
| 2026-09-09 | Phase 8.1 | 状态映射测试和 typecheck 通过；首轮 lint 发现主题按钮在 effect 内同步状态，移除多余 React 状态并以根节点主题类作为唯一事实源 | 4 项目标测试、typecheck 通过；lint 待复核 |
| 2026-09-09 | Phase 8.1 | Algorithm 列表与 Knowledge 详情复用统一状态语义：已掌握绿、待复习黄、薄弱红、未学习灰，并为主要列表/筛选补齐 Dark Mode 语义色 | 静态检查与浏览器验收待运行 |
| 2026-09-09 | Phase 8.1 | Dashboard、Algorithm、Knowledge、Progress、Settings 的主要背景、卡片、筛选、状态和反馈改为主题语义色，保留深色首屏信息区 | 10 项相关测试、lint、typecheck 通过；本轮样式汇合待复核 |
| 2026-09-09 | Phase 8.1 | 深色 Dashboard/Algorithm/Knowledge 视觉通过；客户端导航发现根布局原生 script 警告，按 Next 16 文档改为 `next/script` 的 `beforeInteractive` | 页面主题正确；控制台待复核 |
| 2026-09-09 | Phase 8.1 | 完成全局导航、当前页高亮、系统/手动主题、主要页面深色适配与统一训练状态语义；切回浅色后偏好持久化 | 24 项相关测试、lint、typecheck 通过；新标签路由切换控制台无错误 |
| 2026-09-09 | Phase 8.2 | 按 Next 16 文件约定新增全局 loading、可重试 error 与 404 页面；补充跳到主内容入口、Knowledge 今日空态和设置反馈 live region | 静态检查、404 与浏览器验收待运行 |
| 2026-09-09 | Phase 8.2 | 首轮 typecheck 发现当前 Base UI Button 不支持 `asChild`，错误页返回入口改为原生 Next Link 样式 | lint 通过；typecheck 待复核 |
| 2026-09-09 | Phase 8.2 | 完成 loading、error retry、404、今日任务空态、设置反馈 live region 与键盘跳转入口 | 17 项相关测试、lint、typecheck 通过；未知路由返回 404；新标签控制台无错误 |
| 2026-09-09 | Phase 8.3 | 对齐算法 WA 次数的数据库语义：反馈改为 0/1/2/3+ 原生选择，领域层与本地存储拒绝超出 0–3 的值，避免真实写库时违反约束 | 目标测试、lint、typecheck 待运行 |
| 2026-09-09 | Phase 8.3 | WA 边界测试与静态检查通过；按 Next 16 Proxy 指南排除 `/api` 页面重定向，使 Route Handler 可返回稳定 JSON 401 | 75 项目标测试、lint、typecheck 通过；生产 Smoke 待真实环境执行 |
| 2026-09-09 | Phase 8.3 | 增加 Supabase 远端目录计数校验和无副作用 Smoke Test，支持两次 Seed 后计数确认与未登录生产边界验证 | 本地脚本待验证；真实 Supabase/Vercel 凭据仍未提供 |
| 2026-09-09 | Phase 8.3 | README 更新为当前 V1 状态、两次 Seed、双用户 RLS、Vercel 环境、人工验收与恢复手册；明确云端训练写入尚未完成 | 文档已完成；下一步实现 Supabase 训练数据适配层 |
| 2026-09-09 | Phase 8.3 | Smoke 首轮发现 Windows npm 会吞掉 `--base-url` 风格参数，改为兼容位置 URL 与 `demo` 标记，并同步 README 命令 | 直接脚本验收通过；npm 包装命令待复核 |
| 2026-09-09 | Phase 8.4 | 新增 Algorithm 完成与 Knowledge 提交的 Supabase 事务函数：同一事务写 attempt、upsert state 并完成当天 task；函数使用调用者身份和 RLS，拒绝匿名执行 | Migration 静态审查完成；待类型、服务层和真实项目验证 |
| 2026-09-09 | Phase 8.4 | 为两个训练事务函数补齐手写 Supabase Database Args/Returns 类型，后续 Route Handler 不需要绕过类型系统 | typecheck 待运行 |
| 2026-09-09 | Phase 8.4 | 根据 Luna 并发审查补充算法 Start 事务与 resume 语义；Knowledge 事务增加同用户同题 advisory lock 和 expected attempt count，防止双击提交造成 attempt/state 计数漂移 | Migration/类型待静态复核与真实项目验证 |
| 2026-09-09 | Phase 8.4 | 新增服务器 Supabase 训练适配层：映射 Profile/Attempt/State/Task 到现有领域模型、幂等生成当天任务、事务化开始/完成算法、Learn/Recall 八股和更新设置 | 静态检查与无凭据测试待运行 |
| 2026-09-09 | Phase 8.4 | 适配层首轮 typecheck 发现数据库 `reason` 是宽字符串而 Planner 使用窄联合，增加运行时白名单并保留非法云数据显式失败 | 初次 typecheck 2 处错误；修正后待复核 |
| 2026-09-09 | Phase 8.4 | 增加云端行映射和 SQL 事务契约测试，覆盖 Profile 时区、算法 UUID↔LeetCode ID、八股匹配证据、认证边界与并发锁形状 | 目标测试待运行 |
| 2026-09-09 | Phase 8.4 | 服务层区分 Supabase 序列化冲突/唯一冲突与普通网关错误，为 Route Handler 稳定返回 409 做准备 | 路由与测试待实现 |
| 2026-09-09 | Phase 8.4 | Algorithm Complete 与 Knowledge 提交按客户端 attempt ID 实现读取后幂等返回；网络响应丢失后的同 ID 重试不会重复累加 mastery 或 attempt count | typecheck 与幂等测试待运行 |
| 2026-09-09 | Phase 8.4 | 新增受认证的云端 Snapshot、Algorithm、Knowledge、Profile Route Handlers 和统一前端请求客户端；输入边界在服务端校验，响应返回最新 Snapshot 供 UI 原位同步 | 静态检查与路由测试待运行 |
| 2026-09-10 | Phase 8.4 | Route 首轮 lint/typecheck 通过；把 Knowledge rating/answer 边界校验移到任何数据库调用之前，并将可测试路由改为相对导入 | lint、typecheck 通过；路由测试待运行 |
| 2026-09-10 | Phase 8.4 | 增加四组云端 Route Handler mock 测试：JSON 401、认证用户不可由 body 覆盖、WA/自评前置校验和 Profile 无效输入 | 目标测试待运行 |
| 2026-09-10 | Phase 8.4 | 路由测试首轮被 Supabase server 模块的 Next 路径别名阻断；不新增 Vitest 配置，将该模块内部导入改为等价相对路径 | 云端映射 4 项通过；路由套件加载失败，待复核 |
| 2026-09-10 | Phase 8.4 | 增加无全局 Provider 的轻量云端 Snapshot Hook，统一异步加载、刷新、错误和局部更新，供现有六个业务组件复用 | 路由+映射 9 项已通过；UI 接线待实现 |
| 2026-09-10 | Phase 8.4 | Algorithm 列表移除非 Demo 只读分支，云端模式加载 Supabase 状态/今日任务并复用全部筛选、mastery 和到期展示；增加同步中与失败反馈 | 静态检查待运行 |
| 2026-09-10 | Phase 8.4 | Knowledge 总览接入云端 Snapshot，Supabase 模式可展示今日任务、Topic mastery、已学习/已掌握/到期统计，不再退化为只读题库 | 静态检查待运行 |
| 2026-09-10 | Phase 8.4 | Dashboard 接入云端 Profile、两类状态、历史 Daily Tasks 与弱项证据，Supabase 模式复用 Day/42、周完成率、连续训练和今日剩余统计 | 静态检查待运行 |
| 2026-09-10 | Phase 8.4 | Progress 接入云端 Snapshot，Supabase 模式可计算核心覆盖、四态计数、两类分类 mastery 与薄弱 Topic Top 10 | 静态检查待运行 |
| 2026-09-10 | Phase 8.4 | Settings 移除云端占位页，Supabase 模式读取并更新本人 Profile，保存后以服务器返回 Snapshot 为准；本地 Demo 路径保持原行为 | 静态检查待运行 |
| 2026-09-10 | Phase 8.4 | Algorithm 训练详情接入云端 Snapshot 与事务接口，支持刷新恢复计时、完成反馈、AI 结果随 attempt 落库和幂等完成；移除“等待 Supabase”禁用态 | 静态检查与路由闭环测试待运行 |
| 2026-09-10 | Phase 8.4 | Knowledge 训练详情接入云端 Learn/Recall 事务接口；关键点匹配仅使用服务器题库，提交后以服务器 Snapshot 更新 mastery/task，并修复云端只读时提前显示答案的问题 | 静态检查与路由闭环测试待运行 |
| 2026-09-10 | Phase 8.4 | 云端 UI 首轮检查发现 Settings 闭包未保留 Profile 非空收窄、Snapshot Hook 在 effect 内直接触发状态更新；固定当前 Profile 引用并延迟初次刷新 | 初次 typecheck 7 处错误、lint 1 处错误；修正后待复核 |
| 2026-09-10 | Phase 8.4 | Progress/Settings 云端状态标识与实际实现对齐，README 改为“适配层已实现、真实项目未验收”；Learn 自评只接受真实数字 1–4 | lint、typecheck 待复核 |
| 2026-09-10 | Phase 8.4 | 云端 attempt/question 标识在进入 Supabase 前增加 UUID 格式校验，避免 PostgREST 类型错误被误报为服务器故障 | 路由边界测试待更新 |
| 2026-09-10 | Phase 8.4 | Knowledge 提交增加保存中禁用态和稳定 pending attempt UUID；响应丢失后再次提交沿用同一 ID，由服务端幂等读取已保存结果 | 静态检查待运行 |
| 2026-09-10 | Phase 8.4 | Algorithm Start/Complete 增加保存中互斥与可读按钮状态，避免双击触发并发请求；数据库事务仍提供最终一致性保护 | 静态检查待运行 |
| 2026-09-10 | Phase 8.4 | 云端 UI/Route 首轮汇合通过 typecheck 和 9 项目标测试；清理 UUID 校验替代后遗留的 Knowledge 未使用 helper | typecheck、9 项测试通过；lint 仅 1 条 warning，清理后待复核 |
| 2026-09-10 | Phase 8.4 | Algorithm 完成事务同时完成开始日与结束日对应任务，覆盖跨午夜训练并与本地 Demo 语义一致；计划日期更新到新工作日 | Migration 契约、typecheck 待复核 |
| 2026-09-10 | Phase 8.4 | 跨午夜事务参数完成静态复核；浏览器逐页检查 Dashboard、Algorithm、Knowledge、Progress、Settings，并在 390×844 手机尺寸复核主面板、训练页和设置页 | typecheck、lint、9 项云端目标测试通过；桌面/手机控制台 0 错误与警告 |
| 2026-09-10 | Phase 8.4 | 生产 Smoke 扩展到 Snapshot、Algorithm、Knowledge、Profile 四个训练 API，统一验证未登录时返回 JSON 401 | 本地 Demo Smoke 与完整质量门待复核 |
| 2026-09-10 | Phase 8.4 | 完成本地云端适配收口质量门并恢复开发服务；同步确认四项不依赖外部环境的 V1 验收标准 | lint/typecheck/test/build 通过；22 个测试文件、215 项测试、237 个页面；重启后 Demo Smoke 通过 |
| 2026-09-10 | Phase 8.4 | 生产 Smoke 自查发现 Profile Route 使用 PUT 而脚本误用 POST，已对齐真实方法并让所有非 GET 请求发送最小 JSON 请求体 | `node --check scripts/smoke.mjs` 与本地 Demo Smoke 待复核 |
| 2026-09-10 | Phase 8.4 | Profile 云端服务补齐运行时字符串字段校验，伪造 `version: 1` 但缺字段的请求不再从 TypeError 落入 500 | 新增回归测试；静态检查待运行 |
| 2026-09-10 | Phase 8.4 | Route 回归测试覆盖四个训练接口的匿名边界：均在解析无效请求体前返回 JSON 401，且不会触发任何训练读写 | 目标测试与静态检查待运行 |
| 2026-09-10 | Phase 8.4 | Luna 终审指出算法同一 attempt 跨标签页并发完成时第二个 RPC 会返回 P0002；服务层现将其映射为可恢复的 409 冲突，不再误报 500 | 新增冲突码回归测试；目标测试待运行 |
| 2026-09-10 | Phase 8.4 | 训练完成事务不再用“当前 Profile 时区”反推任务日期，而是完成该资源全部未完成任务；修复训练中切换时区或跨午夜后原任务遗留为 pending/in_progress，并移除多余日期参数与 Profile 查询 | SQL 契约、类型和服务层目标测试待运行 |
| 2026-09-10 | Phase 8.4 | 云端 Snapshot Hook 每 30 秒及窗口重新聚焦/恢复可见时检测 Profile 时区日期；仅在日期真正变化时刷新，长开页面跨午夜不再停留昨日任务 | lint、typecheck 与浏览器回归待运行 |
| 2026-09-10 | Phase 8.4 | 云端 Snapshot 对 Algorithm Attempts、Knowledge Attempts 与 Daily Tasks 使用稳定排序的 1000 行分页读取，长期训练超过 PostgREST 单次上限后统计不再静默截断 | typecheck、lint 与回归测试待运行 |
| 2026-09-10 | Phase 8.4 | 明确个人版信任模型：RLS 防止跨用户访问，但不阻止用户修改自己的训练分数；README 记录未来多人防作弊场景才需要受信服务器写入，生产运行时仍不引入 service-role key | Luna 安全发现按产品边界复核并记录 |
| 2026-09-10 | Phase 8.4 | Luna 终审的有效本地问题全部收口：P0002 并发冲突、时区任务错配、跨午夜长开页面和 PostgREST 历史截断；旧快照报告的 Smoke/Profile 问题也已复核修复 | lint/typecheck/test/build 通过；22 个测试文件、217 项测试、237 个页面；seed:check 与重启后 Demo Smoke 通过 |
| 2026-09-10 | Phase 8.5 | 检查真实联调前置条件：Supabase URL、publishable/service-role key、OpenAI key 均未配置，本机也无 Supabase/Vercel CLI；开发服务保持在 localhost:3000 | 外部项目创建、Migration/Seed、双用户 RLS、Auth 与 Vercel 部署等待用户提供项目访问条件 |
| 2026-09-10 | Phase 8.5 | 完成度审计发现生产 Smoke 对未知受保护页面错误要求匿名 404；现按真实代理语义区分：Demo 验证自定义 404，生产匿名请求验证 307/308 跳转登录 | 脚本语法、本地 Demo Smoke 与质量检查待复核 |
| 2026-09-10 | Phase 8.5 | 按 Supabase 当前官方 CLI 流程加入项目级固定版本 CLI，并生成可提交的 `supabase/config.toml`；本地 Auth URL/密码下限对齐应用，关闭未使用且不存在的 `seed.sql` 流程，README 改用 `npx` 与 push dry-run | `npx supabase init` 成功；配置与依赖质量门待复核 |
| 2026-09-10 | Phase 8.5 | Hot 100 刷新脚本不再把首次快照日期永久写死，后续经用户主动刷新时按 Asia/Shanghai 的实际执行日写入静态快照日期 | 脚本语法与 lint 待复核；当前 2026-09-08 数据快照未改动 |
| 2026-09-10 | Phase 8.5 | Smoke 所有请求增加 15 秒超时；初始 Migration 增加 9 表 RLS、6 个本人数据策略、3 个 authenticated-only 公共目录策略的静态契约测试 | 不能替代真实双用户 RLS；目标测试与完整质量门待运行 |
| 2026-09-10 | Phase 8.5 | 新增真实 Smoke 脚本的生产分支回归测试，以临时本地 HTTP 服务验证登录页、受保护页面跳转、五个 JSON 401 API、Profile PUT 与未知页认证边界 | 目标测试与静态检查待运行 |
| 2026-09-11 | Phase 8.5 | 对照原始规格补齐 Dashboard Algorithm 的当前 mastery，采用已训练题平均值且不让未学习题按 0 分稀释；无状态时显示明确空态 | lint、typecheck 与浏览器验收待运行 |
| 2026-09-11 | Phase 8.5 | 修复 date-only 计划起点在 America/Los_Angeles 等负 UTC 时区被解析为前一天：日期键函数现保留合法 `YYYY-MM-DD` 的日历语义，并覆盖 Algorithm/Knowledge 回归 | 目标测试、lint、typecheck 待运行 |
| 2026-09-11 | Phase 8.5 | Knowledge 训练详情的标签、Learn 卡和 Recall 表单移除硬编码白底，统一使用主题 `card` 语义色，避免 Dark Mode 白底浅字 | lint、typecheck 与深色浏览器验收待运行 |
| 2026-09-11 | Phase 8.5 | Algorithm/Knowledge 训练详情复用云端 Snapshot Hook：初始加载、30 秒日期检测、focus/visibility 恢复与写入后 Snapshot 均走同一路径，长开详情页跨午夜可自动更新 | lint、typecheck 与云端回归测试待运行 |
| 2026-09-11 | Phase 8.5 | Snapshot 回调首轮 lint 禁止渲染期写 ref，改为 effect 同步最新回调；初始加载 effect 按声明顺序读取更新后的 ref | 初次 lint 1 个 error，修正后待复核；typecheck 已通过 |
| 2026-09-11 | Phase 8.5 | 云端算法 Snapshot 从“只比 100 条数量”加强为精确 LeetCode ID 集合校验；远端验证脚本增加算法、Topic、全量问题和核心问题四组精确 ID 集合分页比对 | 脚本语法、lint、typecheck 与静态回归待运行；真实远端待凭据 |
| 2026-09-11 | Phase 8.5 | AI Route 将非 Demo 的 Supabase 客户端/鉴权异常纳入 JSON 错误边界；配置缺失或认证服务故障现返回 JSON 503，不再落入 Next HTML 500 | 新增生产模式配置失败回归测试；目标测试待运行 |
| 2026-09-11 | Phase 8.5 | 完成本轮本地收口：统一任务完成语义、真实五 Topic 7 天回放、长历史分页/精确题库 ID 行为测试及 Knowledge 暗色验收 | lint/typecheck/test/build 全通过；23 个测试文件、226 项测试、237 个页面；seed:check 与本地 Demo Smoke 通过；开发服务已重启 |
| 2026-09-11 | Phase 8.5 | 采纳 Luna 终审：本地算法仅把 pending 任务置为进行中，保留已完成历史；Knowledge Snapshot/本地存储兼容 in_progress 并在提交后完成；适配器测试增加二次加载幂等与字段映射 | Luna 复核无遗留高/中优先级问题；lint/typecheck/test/build 全通过，23 个测试文件、226 项测试、237 个页面；seed:check 与重启后 Demo Smoke 通过 |
| 2026-09-11 | Phase 8.5 | 本地 Demo 的 Dashboard、Progress、Algorithm/Knowledge 总览与训练详情增加每分钟、窗口聚焦和恢复可见刷新；Algorithm 详情刷新时同时生成新日期任务并同步跨标签页计时状态 | 浏览器刷新后任务保持 2+3 且控制台无错误；lint/typecheck/test/build 全通过，23 个测试文件、226 项测试、237 个页面；seed:check 与重启后 Demo Smoke 通过 |
| 2026-09-11 | Phase 8.5 | 新增 Node 24 内置 SQLite 本地训练数据库：单文件持久化 Profile/Algorithm/Knowledge 状态，复用现有 Planner/Attempt/Mastery，支持浏览器 Demo 首次导入、算法与八股幂等写入及进程重启恢复 | 24 个测试文件、227 项测试全部通过；lint/typecheck/build、seed:check、重启后 SQLite API/页面和 Smoke 通过，构建 237 页且无路径追踪警告 |
| 2026-09-12 | Phase 8.5 | 登录并连接真实 OfferPilot Supabase 项目，Dry Run 精确确认后应用两份 Migration；保留云端邮箱确认/MFA 等安全默认，不整份覆盖本地 `config.toml` | 本地/远端 Migration 历史完全一致；Seed 连续两次成功；100 / 165 / 904 / 120 数量和四组精确 ID 集合全部通过 |
| 2026-09-12 | Phase 8.5 | 增加可重复执行的远端双用户 RLS 验证命令，覆盖 6 张私有表的本人可见/他人隔离、跨用户写入和删除拒绝、题库认证读取边界，并自动清理临时账号 | 真实 Supabase 执行通过；临时账号及数据已清理 |
| 2026-09-12 | Phase 8.5 | 修复注册成功后的中文 Server Action 跳转触发非法响应头并表现为无响应；统一编码登录反馈，并将常见登录与邮件限流错误转换为中文 | 已确认真实账号创建且完成确认；浏览器反馈验收通过；Node 24 下 lint/typecheck/test/build 全通过，25 个测试文件、229 项测试、237 个页面 |
| 2026-09-12 | Phase 8.5 | 创建 Vercel 项目并配置真实 Supabase 生产变量，发布稳定域名；Supabase Site URL 与本地/生产 Auth 回调白名单同步完成，生产域名公开且 Preview 保持保护 | Vercel Node 24 构建成功并生成 237 个页面；部署状态 READY；本机到 `vercel.app:443` 超时，远端 Smoke 待换网络验收；GitHub 自动部署待授权 Vercel GitHub App |
| 2026-09-13 | Phase 8.5 | 处理“漏学一天后欠账不可见”问题：算法/八股 Planner 增加逾期复习配额上浮（最多 3 倍、封顶实际逾期数、配 0 不上浮），新增 `calculateTrainingBacklog` 汇总逾期复习与往日遗留任务，Dashboard 增加补账提示卡片与入口；新题语义不变，漏学内容顺延不丢失 | Node 24 下 lint/typecheck/test/build 全通过；25 个测试文件、241 项测试、237 个页面 |
| 2026-09-13 | Phase 8.5 | 修复重设计划起点后旧任务仍显示欠账：欠账统计仅包含当前计划开始日至昨天的未完成任务，保留旧历史、Mastery 与真正到期复习 | 目标回归通过；Node 24 下 lint/typecheck/test/build 全通过；25 个测试文件、242 项测试、237 个页面 |
| 2026-09-13 | Phase 8.5 | 完成 Hot 100 外部完成记录批量导入：支持题号、`[题号]题名`、链接识别与去重；以 60% 初始掌握度在 3 天后复习，本地 SQLite/Supabase 均持久化，不伪造 Attempt、不覆盖已有记录，并完成对应待办任务 | 页面导入 2 题验收通过且控制台无错误；Node 24 下 lint/typecheck/test/build 全通过；26 个测试文件、245 项测试、237 个页面 |
| 2026-09-13 | Phase 8.5 | 增加八股 Recall 的用户主动 AI 语义复核：服务端通过 OpenAI 兼容 Chat API 调用阿里百炼，使用非思考模式和严格 JSON Schema 返回语义覆盖、遗漏、误区及改进表达；API Key 不下发浏览器，AI 不修改确定性 mastery；本地已配置用户提供的北京 Base URL、`qwen3.7-flash` 和私密 Key | Node 24 下 lint/typecheck/test/build 全通过；28 个测试文件、250 项测试、238 个页面；真实百炼调用返回 `structured_ok=true` |
| 2026-09-13 | Phase 8.5 | 将 AI Recall 提交并推送到 `main`，在 Vercel Production 配置 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 三项服务端变量并重新发布稳定域名 | Commit `861496f` 已推送；部署 `dpl_EBBFhk7fM3rDPB82yaZwpHsp9tZo` 状态 READY、构建 238 个页面；本机访问 `vercel.app:443` 持续超时，生产匿名与登录后 Smoke 保持待验收 |
| 2026-09-13 | Phase 8.5 | 修复生产算法 AI 代码复盘超时：将不受当前阿里百炼兼容端点支持的 Responses API 改为已验证的 Chat Completions，保持严格 JSON Schema、非思考模式、20 秒超时和服务端密钥边界 | Vercel 日志确认旧接口返回 504；同配置探测为 Responses 400、Chat 成功；真实代码复盘 Route 返回 200（约 5.2 秒）；Node 24 下 lint/typecheck/test/build 全通过，28 个测试文件、250 项测试、238 个页面 |
| 2026-09-13 | Phase 8.5 | 在现有算法 AI 代码复盘中增加“本题 Java 基础语法”：最多 4 张卡片，展示代码实际涉及方法的用途、标准写法、最小示例和易错点；复用现有 AI 请求与 Attempt JSON 持久化，并兼容无该字段的旧复盘 | 真实 `qwen3.7-flash` 复盘返回 `String.toCharArray()`、`Arrays.sort(char[])` 等 3 项语法知识；Node 24 下 lint/typecheck/test/build 全通过，28 个测试文件、252 项测试、238 个页面 |
| 2026-09-13 | Phase 8.5 | 优化算法写题流程：未提交 Java 代码按 Attempt 自动保存在当前浏览器并可刷新恢复；训练反馈先独立保存，完成后再请求 AI，分析结果追加到同一 Attempt，覆盖浏览器 Demo、本地 SQLite 与 Supabase，且不重复计算 mastery | 浏览器验证草稿刷新恢复、先保存后出现 AI 按钮且控制台无错误；Node 24 下 lint/typecheck/test/build 全通过，28 个测试文件、255 项测试、238 个页面 |
| 2026-09-13 | Phase 8.5 | 将算法写题流程优化提交并推送到 `main`，交由已连接的 Vercel Git 集成自动部署 | Commit `195ec97` 已推送且远端 `main` 一致；部署 `dpl_DHKg6xKD9Bd47L9QCp2FSmCTiftR` 状态 READY，稳定域名已指向新版本 |
| 2026-09-13 | Phase 8.5 | 补齐算法训练取消流程：计时卡增加二次确认的取消入口，撤销未完成 Attempt、恢复进行中任务并清除该次代码草稿；浏览器 Demo、本地 SQLite 与 Supabase 共用一致语义，不改变历史成绩与 Mastery | 4 个目标测试文件 31 项通过；Node 24 下 lint/typecheck/test/build 全通过，28 个测试文件、258 项测试、238 个页面 |
| 2026-09-13 | Phase 8.5 | 将算法训练取消功能提交并推送到 `main`，由 Vercel Git 集成自动部署 | Commit `68054f3` 已推送且远端 `main` 一致；部署 `dpl_7ZfxUw49swrvp7TfdFTPvYAymPuw` 状态 READY，稳定域名已切换到新版本 |
| 2026-09-13 | Phase 8.5 | 把算法训练页从纯计时器改为可直接写题：计时状态展示大尺寸 Java 编辑区，关闭拼写/自动修正，复用现有按 Attempt 保存的浏览器草稿，结束训练后同一代码自动进入反馈 | Node 24 下 lint/typecheck/test/build 全通过，28 个测试文件、258 项测试、238 个页面；在线编译与判题按安全边界延后 |
| 2026-09-13 | Phase 8.5 | 将算法计时页 Java 编辑区提交并推送到 `main`，由 Vercel Git 集成自动部署 | Commit `33d11b3` 已推送且远端 `main` 一致；部署 `dpl_CWDuY5fpuZTJ8citZ3hF7xuYiWLb` 状态 READY，稳定域名已切换到新版本 |
| 2026-09-13 | Phase 8.5 | 为 Hot 100 增加独立静态内容快照：从 LeetCode 官方接口采集 100 道纯文本题面与 Java 初始代码，训练详情按题号合并；新 Attempt 无草稿时填入模板，已有草稿（包括主动清空）优先，支持确认后恢复模板，未修改模板不作为代码提交；内容不进入 Supabase Seed，也不在运行时抓取 | 快照 100/100、唯一 ID、非空题面/模板和无 HTML 校验通过；`seed:check` 保持 100 / 165 / 904 / 120；本地 `/algorithm/49` 题面只读检查通过；Node 24 下 lint/typecheck/test/build 全通过，28 个测试文件、259 项测试、238 个页面 |
