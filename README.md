# OfferPilot

OfferPilot 是一个可每天使用的个人秋招训练系统，围绕两条闭环工作：LeetCode Hot 100 算法训练，以及 Java 后端八股学习与主动回忆。

42 天是第一训练周期，不是产品寿命上限。Day 42 后不会清空进度，已到期的算法和八股仍会继续进入复习任务。

## 当前状态

- Phase 0–7 已完成：算法与八股规则、每日 Planner、训练闭环、Dashboard、Progress、Settings 和可选 AI 代码复盘均可在本地使用。
- Phase 8 的导航、深色模式、响应式基础、状态语义、Loading/Error/404 和可访问性已完成。
- 当前默认使用服务器端 SQLite 单文件持久化，重启服务或更换浏览器不会丢失进度。
- 真实 Supabase Migration、Seed、Auth/RLS 联调和 Vercel 部署需要项目凭据，仍是 Phase 8 的外部执行项。
- Supabase 训练适配层、受认证 Route Handler 与事务 Migration 已在本地实现；尚未在真实项目执行 Migration/Seed/RLS/Auth 验收，因此当前版本仍不能视为云端生产完成版。

详细执行进度以 [PLAN.md](PLAN.md) 为准。

## 技术栈

- Next.js 16 App Router、React 19、TypeScript strict
- Tailwind CSS 4、shadcn/ui
- Node.js 内置 SQLite（当前本地数据库）
- Supabase Auth、PostgreSQL、RLS（后续部署）
- OpenAI Responses API（可选代码复盘）
- Vitest
- Vercel 目标部署平台

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
| `OPENAI_API_KEY` | 可选 AI 代码复盘 | 服务器 |
| `OPENAI_BASE_URL` | OpenAI 兼容网关；默认官方地址 | 服务器 |
| `OPENAI_MODEL` | AI 复盘模型；默认 `gpt-5.5` | 服务器 |

没有 `OPENAI_API_KEY` 时，只有“AI 分析代码”会显示配置错误；训练反馈、得分和 mastery 仍可保存。

## Supabase 初始化

1. 创建 Supabase 项目，并把 `.env.local` 中三个 Supabase 变量替换为真实值。
2. 项目已经包含固定版本的 Supabase CLI 与 `supabase/config.toml`。登录、关联项目，先预览再应用 Migration：

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

Migration 位于 `supabase/migrations/`，包含 9 张表、训练事务、索引、触发器、约束和 RLS。不要在生产控制台手改一份无法追踪的不同 Schema。目录数据由后面的 JavaScript Seed 脚本导入，因此 `supabase/config.toml` 关闭了 CLI 自带的 `seed.sql` 步骤。

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
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.5
```

不要把 `SUPABASE_SERVICE_ROLE_KEY` 配置到前端运行环境；Seed 应在可信本地终端执行。部署完成后，将最终域名补进 Supabase Auth 的 Site URL 与 Redirect URLs。

未登录 Smoke Test：

```powershell
npm run smoke -- https://你的域名
```

本地 SQLite Smoke Test：

```powershell
npm run smoke -- http://localhost:3000 demo
```

生产验收还需人工走通注册、邮箱确认、登录、退出，以及 Algorithm/Knowledge 各一次完整训练闭环。

## 常见问题与恢复

- 页面提示 Supabase 未配置：检查 URL 和 Publishable Key 是否同时存在，修改后重启本地服务或重新部署。
- 注册后没有邮件：检查 Supabase Email Provider、Site URL、Redirect URLs 和确认邮件模板。
- 未登录页面没有跳转：确认生产 `LOCAL_DEMO_MODE=false`，并检查 Supabase 项目值是否来自同一个项目。
- Seed 失败：确认使用的是 Service Role Key；重新运行 `npm run seed` 是安全的，因为目录写入使用稳定 ID/唯一键 upsert。
- 数据计数不符：先运行 `npm run seed:check` 排除本地事实源损坏，再重新执行 Seed 和 `npm run supabase:verify`。
- AI 分析失败：确认服务器端 OpenAI 三项配置；AI 失败不会改变确定性 mastery，也不应阻止保存普通训练反馈。
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

V1 不单独建立 weakness 表：算法弱项由错误标签与可选 AI 分析聚合，只参与统计和推荐，不直接修改 mastery。

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
