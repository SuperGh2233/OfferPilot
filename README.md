# OfferPilot

OfferPilot 是一个可每天使用的个人秋招训练系统，围绕两条闭环工作：LeetCode Hot 100 算法训练，以及 Java 后端八股学习与主动回忆。

42 天是第一训练周期，不是产品寿命上限。Day 42 后不会清空进度，已到期的算法和八股仍会继续进入复习任务。

## 当前状态

- Phase 0–7 已完成：算法与八股规则、每日 Planner、训练闭环、Dashboard、Progress、Settings 和可选 AI 代码复盘均可在本地使用；Phase 8 已加入八股回忆 AI 语义复核。
- Phase 8 的导航、深色模式、响应式基础、状态语义、Loading/Error/404 和可访问性已完成。
- 本地 Demo 可使用服务器端 SQLite 单文件持久化；生产环境使用真实 Supabase Auth、PostgreSQL 与 RLS。
- Supabase Migration、两次 Seed、精确题库校验和双用户 RLS 隔离已通过；真实注册账号已创建并确认。
- Vercel 生产站点已发布到 [offerpilot-dun.vercel.app](https://offerpilot-dun.vercel.app)。2026-09-14 旧版已通过真实账号训练闭环；2026-09-18 AI 计分版通过匿名 Smoke，但新版认证态复测仍待完成。
- 第一轮时区与任务并发修复：用户反馈已完成测试，但当前连接未独立核对测试报告、Supabase 迁移或部署状态。
- 第二轮性能改造进行中：算法开始/取消/完成/AI 复盘及八股 Learn/Recall 已改为返回增量结果，浏览器合并本次 Attempt、State 和任务状态；不再每次写入重拉全量历史。首次加载、导入和设置保存目前仍使用完整 Snapshot；本轮代码尚待质量门和真实账号验收。
- 优化方案第 3 项已编写（未验收）：八股训练页可从历史 Attempt 恢复已保存的 AI 语义复核，比较同题相邻两次 Recall 的连续遗漏、新遗漏和补齐点，并展示一条有针对性的下次复习提示；不新建数据库字段、不修改 Mastery，测试用例尚待执行。
- 2026-09-20 新增手动暂停计划代码：Settings 一键暂停/恢复，Dashboard 显示暂停状态；休息日不生成新任务、不计漏训、不占 42 个有效训练日，历史、Mastery 和已有任务保留；恢复后按休息天数延后符合条件的复习日期。浏览器 Demo、SQLite、Supabase 均有适配代码；**Migration `202609200002_plan_pause.sql` 尚未验证或应用，不得在应用迁移前部署这些代码。**

详细执行进度以 [PLAN.md](PLAN.md) 为准。

## 技术栈

- Next.js 16 App Router、React 19、TypeScript strict
- Tailwind CSS 4、shadcn/ui
- Node.js 内置 SQLite（本地 Demo 数据库）
- Supabase Auth、PostgreSQL、RLS（生产数据库）
- OpenAI 兼容 Responses / Chat API（可选代码复盘与八股回忆语义复核）
- Vitest
- Vercel 生产部署平台

需要 Node.js 22.13 或更高版本。

## 本地数据库

```powershell
npm install
Copy-Item .env.example .env.local
```

把 `.env.local` 中的本地数据库开关改为：

```text
LOCAL_DEMO_MODE=false
LOCAL_DATABASE_MODE=true
LOCAL_DATABASE_PATH=.offerpilot/offerpilot.sqlite
```

然后启动：

```powershell
npm run dev
```

打开 `http://localhost:3000/dashboard`。数据保存在 `.offerpilot/offerpilot.sqlite`，该目录已被 Git 忽略。如果当前浏览器里已有旧 Demo 进度，首次进入时会自动导入 SQLite；导入后所有页面都通过后端接口读写数据库。

`LOCAL_DATABASE_MODE` 只在开发环境生效，不会让生产构建绕过认证。如果仅需无持久化的浏览器 Demo，可反过来设置 `LOCAL_DEMO_MODE=true` 且 `LOCAL_DATABASE_MODE=false`。

## 环境变量

从 `.env.example` 创建 `.env.local`，不要提交真实密钥。

| 变量 | 用途 | 暴露范围 |
| --- | --- | --- |
| `LOCAL_DEMO_MODE` | 无持久化的浏览器 Demo 开关；生产必须为 `false` | 服务器 |
| `LOCAL_DATABASE_MODE` | 本地 SQLite 模式开关；生产必须为 `false` | 服务器 |
| `LOCAL_DATABASE_PATH` | SQLite 文件路径，默认 `.offerpilot/offerpilot.sqlite` | 服务器 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | 浏览器可见 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Publishable Key | 浏览器可见 |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅用于本地 Seed/校验 | 服务器；禁止进入浏览器和 Vercel 前端变量 |
| `NEXT_PUBLIC_SITE_URL` | 邮箱确认回跳地址 | 浏览器可见 |
| `OPENAI_API_KEY` | 可选 AI 代码复盘与八股回忆复核 | 服务器 |
| `OPENAI_BASE_URL` | OpenAI 兼容网关地址 | 服务器 |
| `OPENAI_MODEL` | AI 模型名称 | 服务器 |
| `OPENAI_TRANSCRIBE_MODEL` | 百炼语音模型名称，默认 `qwen3-asr-flash` | 服务器 |
| `ASR_SERVICE_URL` | 独立 FunASR 服务地址；配置后优先使用，失败自动回退百炼 | 服务器 |
| `ASR_SERVICE_TOKEN` | FunASR 服务共享令牌 | 服务器 |

没有 `OPENAI_API_KEY` 时，“AI 分析代码”和“AI 分析回答”会显示配置错误；训练反馈、得分和 mastery 仍可保存。八股 Recall 采用 `effectiveCoverageScore = max(确定性关键词覆盖率, 提交时的 AI 语义分)` 参与 TypeScript mastery 与复习计算；原始关键词分仍独立保存。AI 不可用时退化为确定性分，提交后补做的 AI 分析不改历史得分。当前 V1 信任用户维护自己的分数：训练接口对客户端提供的 AI JSON 仅做结构校验，普通用户也有本人数据的 RLS 写权限，因此不提供不可篡改成绩的安全保证。

## 八股 Recall 历史对比（优化方案第 3 项）

在一道已做过 Recall 的八股题训练页，展开「回忆历史对比」可查看最近一次已落库的 AI 复核；提交第二次及后续 Recall 后，可对照上一次查看「连续两次遗漏」「这次新遗漏」「这次补上了」，并获得一条聚焦遗漏或误区的下次复习提示。未保存 AI 结果的记录采用确定性关键点进行对比；若只有一次含 AI，两个 Attempt 统一按确定性口径比较，避免混用标准。若原参考关键点已被修订，无法准确对应的点单独提示而不算作新遗忘。提示由历史 Attempt 派生，不额外发 AI 请求，不写新表，也不回改历史分数、Mastery 或复习日期。

刷新页面后，历史信息由浏览器 Demo/SQLite 或 Supabase Snapshot 中已经持久化的 Attempt 重建；补做 AI 复核若发生在提交之后，只作临时解释、不计分也不冒充已保存的分析。该功能目前仅完成源码和回归用例编写，尚未执行 Node 质量门、真实账号刷新和上线验证。

## 完成一题后继续下一题

Knowledge 的 Learn/Recall 和 Algorithm 的完成结果页都会直接给出下一步入口，不再要求先返回列表。选择顺序为：当前训练日仍未完成的任务 → 更早的历史欠账 → 没有任务行但已经到期的复习。Knowledge 刚完成 Learn 时，会在当前队列内优先选择另一道 `new` 新学题，因此正常连续学习时按钮显示「学习下一题」；如果转入复习、欠账或到期项，则按钮改为对应的「继续下一题」「继续补欠账」或「继续到期复习」。暂停计划时同样可以沿此入口偿还暂停前欠账，但不会把休息期间才新到期的复习提前放进队列。切换动态题目时会按题目 ID 重置页面本地状态，避免上一题的提交结果、计时或 AI 状态串到下一题。

## Knowledge Graph Sprint 1：面试能力地图

第一版知识图谱不使用在线 AI 重新理解 904 道题，而是复用题库已经存在且稳定的 `category`、`topic_id`、`sourceOrder` 元数据。运行时从同一份 catalog 派生 7 个领域节点、165 个 Topic 节点和 904 条 question→category/topic 映射，因此不会产生另一份容易和题库漂移的知识数据。领域顺序保持当前训练体系，Topic 顺序使用该 Topic 题目的最早来源顺序；Sprint 1 只建立「领域 → Topic → 题目」层级，真正的 prerequisite DAG 和前置知识解锁留到 Sprint 2。

Dashboard 的「面试能力地图」直接从现有 `user_knowledge_state` / Demo state 聚合，不新增 Mastery 表。每个领域同时显示整体能力分和已学习覆盖率：未学习题在整体能力中按 0 贡献，因此只学少量高分题不会把整个领域误判为已经掌握；页面另外列出当前已学习 Topic 中较弱的几个节点。该派生逻辑对浏览器 Demo、SQLite 与 Supabase 共用同一 Snapshot 结构，不需要新 Migration，也不会改变 Attempt、Recall、复习日期或当前 Planner。

本轮新增回归覆盖 904 道题全映射、7/165/172 节点数量、稳定 ID/重建、Mastery 聚合以及能力地图 SSR。Sprint 1 已在便携 Node 24.19 下通过 lint/typecheck/test/build；真实账号 Dashboard 和生产部署仍需单独验收。

## Knowledge Graph Sprint 2：前置知识 DAG 与递进 Planner

Sprint 2 在全部 165 个 Topic 上建立 prerequisite DAG，但不会为了“每个节点都有父节点”而强行串联无关知识。根 Topic 可以直接学习；有明确依赖的 Topic 才设置前置，例如 `HashMap ← Map + equals/hashCode`、`ConcurrentHashMap ← HashMap + CAS + synchronized`、`MVCC ← 隔离级别 + InnoDB`、`Spring 事务 ← AOP + Bean`。图构建会校验所有引用并执行拓扑排序，出现缺失 Topic、自依赖或环会直接失败。

Planner 只对**新学题**启用门控：前置 Topic 至少有一条六周核心 main 题达到 Mastery 45（“基本理解”）才算基础掌握；Mastery 15/30 不解锁后继。没有六周核心 main 题的 Topic 不作为阻塞条件，避免图谱细分节点让学习计划死锁。到期 Review 永远按原来的时间、Mastery 与 backlog 规则执行，不受 prerequisite 限制。多个可学 Topic 同时存在时，先按教学周，再优先较浅 DAG 层级，再使用 importance/sourceOrder 排序。

如果某天初次排题时因为前置未满足只排出 1/3 道新题，完成基础题后会重新检查 readiness，并只补足当天尚未使用的 quota；已经完成的题仍计入每日额度，因此不会因为解锁而把 3 道扩成 4、5 道。Dashboard 新增「当前学习路径」，同时显示现在可以继续学的核心 Topic 和仍被哪些前置知识锁住。

浏览器 Demo/SQLite 直接复用同一 Planner；Supabase 为同日补位新增 `202609220001_knowledge_dag_replenishment.sql`。首次当天整桶排题仍使用原 `ensure_daily_training_tasks`，新 RPC `append_knowledge_training_tasks` 只允许向已经存在的 Knowledge 日桶追加 pending 任务，并使用 advisory lock、服务端 sort_order 和原有同日题目唯一索引保证并发幂等。**部署 Sprint 2 代码前必须先在测试库备份、dry-run 并应用这条 Migration。**

Sprint 2 已在便携 Node 24.19 下通过 lint/typecheck/test/build（40 个测试文件、390 项测试、239 个页面），达到本地质量门；但测试 Supabase Migration、双标签页、刷新/重登、RLS 和真实账号验收仍未执行，因此仍不能视为生产完成。

## Sprint 3：图谱驱动模拟面试

`/interview` 提供第一版图谱驱动模拟面试。开始面试时会基于当前 KnowledgeState 与 prerequisite DAG 冻结本场 5 道题，选题优先级为：已经到期的已学题 → Mastery 较低的薄弱已学题 → 前置知识已满足但尚未学习的核心挑战题 → 普通保持熟练题；同一 Topic 默认只抽一题，不足 5 题时才允许同 Topic 补位。这样模拟面试既覆盖真实薄弱点，也不会完全退化成日常复习列表。

每题支持文本回答和已有语音转写。模拟面试不会调用日常 Learn/Recall 写入链路，不创建 Attempt，不改变 Mastery、复习日期或 daily task；它首先是一个评估模式。确定性评分直接复用现有 `matchKnowledgeKeyPoints`，整场结束后生成总分、领域分、Topic 强弱、遗漏关键点和图谱回补建议。对于低分 Topic，如果其 prerequisite 目前仍未满足，报告会优先建议回补前置节点；否则直接建议复习当前 Topic。

Dashboard 已增加「图谱驱动模拟面试」入口。Sprint 3 现在也接入了可选 AI 面试官增强层：主问题提交后会先冻结原有确定性分数，再生成**一条**追问；模型优先围绕确定性匹配确认的遗漏关键点追问，关键点已覆盖时才追问项目场景和适用边界。AI 配置缺失、超时、网络失败或返回无效结构时自动使用本地确定性追问，因此不会卡住整场面试。追问回答只保存在当前页面内存，不重新计算主问题分数，也不会写 Attempt、Mastery、复习日期或 daily task。

整场结束后，报告页会在原有确定性总分/领域分/Topic 弱点之上展示「AI 辅助解读（不计分）」：AI 只能基于现有报告总结 strengths、improvements、nextStep，不能新增或修改分数；请求失败时立即保留确定性总结。两条新 API 都复用现有登录边界和 server-only OpenAI-compatible 配置，限制请求大小并使用结构化输出校验。Interview Session 仍然只存在内存中，刷新页面会丢失当前场次，这是当前 Sprint 3 的明确设计而不是持久化缺陷。

Sprint 3 AI 增强源码与回归已经写入，但本轮新增代码尚未重新执行项目级 lint/typecheck/test/build，也未做真实账号 AI 正常/失败/Abort/重复点击验收；在这些门槛通过前不能视为本地验收完成，更不能部署。是否持久化整场面试历史将在源码验收后单独决定。

## 暂停与恢复计划

在 Settings → 个人计划中点击「暂停计划」，恢复时点击同一位置的「恢复计划」；Dashboard 显示当前状态和设置入口。暂停自当前 profile 时区的训练日（凌晨 3 点重置）生效，恢复日重新进入计划；同一天暂停/恢复不会跳过这一天。暂停日期不会成为漏训、补排新题或消耗六周周期天数，也不会生成新的暂停日任务；但暂停前已经欠下的新学进度会继续按原计划日期补排，已有未完成任务和暂停前已经逾期的复习仍会在 Dashboard 显示并允许完成。完成这些欠账会正常保存 Attempt、Mastery 和任务状态，但完成发生在暂停日不会伪造成原计划日期的签到，也不会推进训练周期。暂停前安排且在休息期间才到期的复习按完整暂停训练日数顺延；暂停期间主动学习产生的复习不重复顺延。当前为手动恢复，不设自动到期；暂停不强制禁止用户主动练习。

部署顺序：先备份测试数据库，并应用、检查 `supabase/migrations/202609200002_plan_pause.sql`；验证登录用户能切换自己的暂停状态，匿名/其他用户无法控制；再运行完整质量门、双标签页暂停/恢复测试及真实账号训练闭环，通过后部署代码。仅完成源文件编写不等于生产可用。

## Supabase 初始化

1. 创建 Supabase 项目，并把 `.env.local` 中三个 Supabase 变量替换为真实值。
2. 项目已经包含固定版本的 Supabase CLI 与 `supabase/config.toml`。登录、关联项目，先预览再应用 Migration：

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

Migration 位于 `supabase/migrations/`，包含 9 张表、训练事务、索引、触发器、约束和 RLS。`202609200001_daily_task_idempotency.sql` 新增 `ensure_daily_training_tasks(jsonb)`，负责首次完整排题；`202609220001_knowledge_dag_replenishment.sql` 新增 `append_knowledge_training_tasks(jsonb)`，仅负责 prerequisite 解锁后的同日 Knowledge quota 补位。两者都必须在对应代码发布前先备份数据库、在测试环境 dry-run/验证并应用，否则训练 Snapshot 可能因 RPC 不存在而失败。Migration 不删除已有任务；不要在生产控制台手改一份无法追踪的不同 Schema。目录数据由后面的 JavaScript Seed 脚本导入，因此 `supabase/config.toml` 关闭了 CLI 自带的 `seed.sql` 步骤。

3. 在 Authentication 的 URL Configuration 中加入本地地址和最终 Vercel 地址。邮箱验证启用时，Confirm signup 邮件链接使用：

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

4. 连续执行两次 Seed，再验证目录数量：

```powershell
npm run seed
npm run seed
npm run supabase:verify
npm run supabase:verify-rls
```

预期为 100 道算法、165 个 Topic、904 道八股、120 道六周核心主问题；904 道中包含 394 道主问题和 510 道追问。两次 Seed 后计数不变即证明目录导入幂等。

`SUPABASE_SERVICE_ROLE_KEY` 会绕过 RLS，因此数量校验不能证明用户隔离。`npm run supabase:verify-rls` 会创建两个临时已确认账号，验证本人数据可见、另一用户不可读写删除、匿名用户不可读题库且登录用户可读，最后自动删除临时账号及其数据。

V1 的安全边界是“个人训练数据彼此隔离”，不是防作弊系统：普通登录用户只能通过 RLS 读写自己的记录，但拥有自己的浏览器 token，技术上可以改写自己的分数。OfferPilot 不信任任何用户去访问他人数据，却信任用户维护自己的训练记录。若未来改造成面向互不信任用户的排行榜或认证平台，应把 mastery 计算与写入迁移到受信服务器，并撤销普通用户对训练写接口的直接权限；当前个人版不需要在 Vercel 配置 service-role key。

只校验仓库内静态数据、不连接 Supabase：

```powershell
npm run seed:check
```

## Vercel 部署

Next.js 项目无需额外 `vercel.json`。导入仓库后，在 Production 环境配置以下变量：

```text
LOCAL_DEMO_MODE=false
LOCAL_DATABASE_MODE=false
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://你的域名
OPENAI_API_KEY=...              # 可选
OPENAI_BASE_URL=https://your-workspace-id.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3.7-flash
OPENAI_TRANSCRIBE_MODEL=qwen3-asr-flash
# Optional: independent FunASR service; see docs/operations/RUN-20261007-funasr.md
ASR_SERVICE_URL=https://asr.example.com
ASR_SERVICE_TOKEN=...
```

不要把 `SUPABASE_SERVICE_ROLE_KEY` 配置到前端运行环境；Seed 应在可信本地终端执行。部署完成后，将最终域名补进 Supabase Auth 的 Site URL 与 Redirect URLs。

语音转写的 FunASR 服务不运行在 Vercel 中。进入 `asr-service/` 后按 [`docs/operations/RUN-20261007-funasr.md`](docs/operations/RUN-20261007-funasr.md) 构建并部署容器，先通过 `/healthz`，再在 Vercel 配置两个 `ASR_SERVICE_*` 变量。服务只在内存中处理 16 kHz 单声道 WAV；删除这两个变量即可回退到百炼。

未登录 Smoke Test：

```powershell
npm run smoke -- https://你的域名
```

本地 SQLite Smoke Test：

```powershell
npm run smoke -- http://localhost:3000 demo
```

本轮修复发布前须先运行 `npm run lint && npm run typecheck && npm run test && npm run build`，并在测试数据库验证并发打开两次 Dashboard 的实际落库任务与页面一致、洛杉矶夏令时凌晨 3 点前后日期归属正确。应用新 Migration 后再部署代码，使用真实账号走通 Algorithm/Knowledge 完整训练闭环及刷新持久化，最后运行生产 Smoke；当前连接未执行这些验收。

## 常见问题与恢复

- 页面提示 Supabase 未配置：检查 URL 和 Publishable Key 是否同时存在，修改后重启本地服务或重新部署。
- 注册后没有邮件：检查 Supabase Email Provider、Site URL、Redirect URLs 和确认邮件模板。
- 未登录页面没有跳转：确认生产 `LOCAL_DEMO_MODE=false`，并检查 Supabase 项目值是否来自同一个项目。
- Seed 失败：确认使用的是 Service Role Key；重新运行 `npm run seed` 是安全的，因为目录写入使用稳定 ID/唯一键 upsert。
- 数据计数不符：先运行 `npm run seed:check` 排除本地事实源损坏，再重新执行 Seed 和 `npm run supabase:verify`。
- AI 分析失败：确认服务器端 OpenAI 兼容网关三项配置，且 API Key 与网关地域一致；AI 失败不会改变确定性 mastery，也不应阻止保存普通训练反馈。
- 本地 SQLite 数据异常：先停止开发服务，备份整个 `.offerpilot` 目录，再把 `offerpilot.sqlite` 改名后重启。应用会创建新库；不要在没有备份时删除原文件。
- 旧浏览器 Demo 没有自动导入：只有空 SQLite 库会触发首次导入；请先备份现有 SQLite，再换成空库重试。

## 静态数据

```text
data/algorithm/hot100.json
data/knowledge/offerpilot_bagu_full.json
data/knowledge/offerpilot_bagu_core_6weeks.json
```

Hot 100 来自力扣官方“LeetCode 热题 100”学习计划，静态快照日期为 2026-09-08。应用运行时不会抓取 LeetCode。有意识地刷新快照时运行 `npm run snapshot:hot100`。

八股目录完整保留 165 个 Topic、394 道主问题和 510 道追问。六周默认新知识只从 120 道核心主问题生成，follow-up 不占每日新题额度。

### 八股答案审校与清洗（2026-09-20，待验收）

原始 `offerpilot_bagu_full.json`、核心 JSON 及对应 CSV **保留原样**，禁止为了修文案直接修改原始快照。`data/knowledge/answer_review_patches.json` 按稳定 UUID 保存人工核对的答案、关键点和别名修订；`lib/knowledge/content-cleaning.mjs` 只在确认包含作者推广尾巴时裁切整段，避免用“公众号/PDF/链接”等单词全局删除技术内容。运行时 `lib/knowledge/catalog.ts` 和云端 `scripts/seed.mjs` 使用相同的清洗函数，已经存在的 Attempt、Mastery、题目 ID 均不删除或回算。

已直接阅读并定向修订 **33/904 道**：包括抽象类/HashSet/Stream/JVM 首批四题，追加 float 位数、ThreadLocal 弱引用、HashMap 树化、Bean 生命周期、Spring Boot 自动配置版本、MySQL 聚簇索引与班级排名、Redis 事务与断线等，修正短答、面试答、详答和计分关键点，移除部分资料作者经历与宣传尾巴。**其余 871 道尚未逐题审核，不能认定已清洗完成。** 详细审查记录见 `data/knowledge/ANSWER_REVIEW_LOG.md`。以下命令仅用于补充检查，不能替代直接阅读：

```bash
npm run knowledge:audit
npm run knowledge:audit:report  # 生成 output/knowledge-audit.json
npm run seed:check
npm run lint && npm run typecheck && npm run test && npm run build
```

测试通过并确认已有数据备份后，先在测试 Supabase 执行 `npm run seed`，检查 33 道已改题的 short/interview/full/key_points 与数据库一致、数量仍是 904/120、登录态 Recall 评分和旧历史仍可用，再评估生产重跑 Seed。Seed 是按稳定 ID upsert，会更新同 ID 的题库字段，**不能把 `seed:check` 的通过误当成已经更新生产数据库**。本轮尚未运行上述命令或远端写入。

V1 不单独建立 weakness 表：算法弱项由错误标签与可选 AI 分析聚合，只参与统计和推荐，不直接修改 mastery。

## 增量训练写入（2026-09-20，待验证）

`/api/training/algorithm` 的 start/cancel/complete/save_ai_analysis 和 `/api/training/knowledge` 的 Learn/Recall 返回 `{ mutation }`。前端使用 `applyTrainingMutation()` 在现有快照上合并结果，不丢失历史、不重复追加同一 Attempt；发生日期切换或跨页重新进入时仍可重新从后端加载。导入、设置保存暂时保留完整快照响应，避免在尚未验证前改变复杂业务链。

这只是**写入后的全量回读优化**，并没有解决首次加载全量历史的问题；下一步需要根据 Dashboard/Progress/题目详情的实际数据依赖拆分历史分页与汇总接口。完成质量门、登录态回归及真实网络负载测量前，不宣称已取得具体性能提升。

## 质量门

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

## 目录

```text
app/                 页面、认证 Action 和 Route Handler
components/          业务组件和 UI 组件
data/algorithm/      Hot 100 静态快照
data/knowledge/      八股事实源
lib/                 领域规则、Planner、存储和外部服务边界
scripts/             快照、Seed、远端校验和 Smoke Test
supabase/migrations/ PostgreSQL Schema、索引和 RLS
tests/               领域、数据和接口测试
types/               Supabase 数据库类型
```

## V1 边界

V1 不包含岗位抓取、投递管理、面试管理、浏览器或 IDEA 插件、LeetCode 自动同步、语音口试、社交、排行榜、Agent 工作流、RAG、微服务、Kafka 或 Redis。
