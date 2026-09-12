# OfferPilot V1 八股题库解析报告

## 1. 全量统计

| 分类 | 主问题 | 追问 | 🌟主问题 | 合计 |
|---|---:|---:|---:|---:|
| JVM | 55 | 69 | 12 | 124 |
| Java基础 | 56 | 70 | 9 | 126 |
| Redis | 57 | 78 | 13 | 135 |
| Spring | 41 | 39 | 15 | 80 |
| Java并发 | 71 | 86 | 11 | 157 |
| Java集合 | 30 | 34 | 7 | 64 |
| MySQL | 84 | 134 | 15 | 218 |

- 原始抽取：**904** 条
- 保守去重后：**904** 条（合并 0 条近重复）
- 主问题：**394** 条；追问：**510** 条
- 🌟重点主问题：**82** 条
- Topic：**165** 个
- 六周核心计划：**120** 个主问题

## 2. 结构化规则

- EPUB `h2` → `section`；`h3` → `main` 主问题；嵌套 `h4` → `follow_up` 追问。
- `🌟` 保留为 `source_starred=true`，默认 `importance=5`。
- `full_answer` 保留原资料的直接答案正文；不会把子追问正文混入主问题答案。
- `interview_answer` 只从原答案压缩，不凭空补知识；会跳过原文中明确标注“面试中可以不背”的区段。
- `short_answer` 从 `interview_answer` 再压缩为约 80 字以内的快速复习版本。
- `key_points` 优先抽取列表项、编号标签、首要结论和常见技术术语。
- `keyword_aliases` 使用可解释的术语别名表生成，可直接支撑 V1 的关键词主动回忆匹配。
- 去重采用“同分类 + 规范化问题文本 + 极高相似度”保守策略，避免把相似但含义不同的问题误合并；重复来源保留在 `sources`。

## 3. 重要度筛选规则

| importance | 规则 | V1 使用方式 |
|---:|---|---|
| 5 | 原资料带 🌟 的主问题 | 六周优先必学 |
| 4 | 非🌟但命中 Java/JVM/并发/Spring/MySQL/Redis 核心面试主题 | 高频主干 |
| 3 | 普通主问题，或重要主问题下有价值的追问 | 时间允许学习/作为追问 |
| 2 | 较细、较偏、场景性追问 | V1 默认不进入每日新题 |
| 1 | 强个人经历、特定项目、部署经历等问题 | 题库保留，不进入通用六周核心 |

## 4. 六周核心子集

六周核心只把 **120 个主问题**作为可调度的新知识；高价值 h4 追问挂在主问题下，不单独占“每日新题”名额。

| 分类 | 核心主问题配额 |
|---|---:|
| Java基础 | 15 |
| Java集合 | 15 |
| Java并发 | 20 |
| JVM | 18 |
| Spring | 15 |
| MySQL | 22 |
| Redis | 15 |

选择优先级：`importance` > `🌟` > 核心主题命中 > 难度适中 > 原资料顺序。

建议系统每日八股节奏：**3 个新主问题 + 3 个到期复习**。120 个核心题不是要求 42 天全部首刷完；后半程应让到期复习和薄弱项挤占新题名额。

## 5. 数据库导入说明

- `knowledge_topics.csv`：可直接导入 `knowledge_topics`。ID 使用稳定 UUID5。
- `knowledge_questions.csv`：可直接导入 `knowledge_questions`/staging 表；`topic_id` 已与 topics 对齐。
- `key_points`、`keyword_aliases`、`sources` 在 CSV 中是 JSON 字符串，PostgreSQL/Supabase 对应列建议使用 `jsonb`。
- `offerpilot_bagu_full.json`：包含统计、Topics 和全量去重题目，适合作为 seed 或二次转换源。
- `offerpilot_bagu_core_6weeks.*`：六周核心主问题，`core_followups` 内挂接重要追问。