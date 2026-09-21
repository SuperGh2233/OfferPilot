# OfferPilot 实施计划

> 本文件是后续开发的执行基准。每次开始开发前先阅读本文件；每次修改代码后，必须在同一轮更新这里的进度、验证结果和变更记录。

## 当前状态

- 最后更新：2026-09-21
- 当前阶段：Phase 8 已完成；第二轮架构与性能优化（第一轮检查由用户反馈已完成，详细测试结果与生产迁移状态尚未在此连接中核验）。
- 并行开发任务（本 Agent）：2026-09-21 继续优化每日训练流，已修复“暂停计划后无法完成欠账”，并补上完成一题后的直接「下一题」入口。Knowledge Learn/Recall 与 Algorithm 完成页复用纯函数选择下一任务：今日未完成 → 历史欠账 → 到期复习；Knowledge Learn 在今日队列内优先另一道新学题。动态题页按 ID 强制重置本地交互状态。KnowledgeTraining 的 React purity 问题已改为组件时钟定时更新，便携 Node 24.19 下四项质量门已通过；真实账号或生产验收仍未进行。
- 当前任务：八股答案已完成 904 道 UUID 级直接审校投影与本地验收：保留原始 JSON/CSV，使用共享清洗函数及按 UUID 审校补丁；`knowledge:audit`/`knowledge:audit:report` 已核实 904/904 人工审校、0 未审、0 候选，`seed:check` 已核对 100 算法、165 主题、904 题、120 核心题和 904 条清洗详答，lint/typecheck/test/build 已在便携 Node 24.19 下通过（38 个测试文件、369 项测试、239 个生成页面）。下一步仅为测试库备份后的数据库 Seed、真实账号 Recall/刷新历史回归与部署验收；生产题库、学习历史和生产数据库尚未修改，不能宣称生产已更新。此前手动暂停／恢复功能的源码、测试用例、SQL Migration 与用户文档已写入：Settings 切换、Dashboard 状态、算法和八股 Planner、有效周期日/漏训/连续天数、浏览器 Demo/SQLite/Supabase 持久化、复习日期延后。暂停范围按用户当地 03:00 训练日记录为 [start,end)，恢复当日重新生成任务；旧 Attempt/Mastery/任务保留。云端通过单独的事务 RPC 防重复切换；本轮仅文件读写，未能运行数据库迁移或真实端到端验收，不能推送或宣布上线。上一批增量写入仍待其独立验收。
- 已完成：Phase 0、Phase 1 本地版本、Phase 2、Phase 3、Phase 4、Phase 5、Phase 6、Phase 7、Phase 8
- 本地运行：`http://localhost:3000`；已切换真实 Supabase 模式，本地 SQLite 文件保留
- 云端状态：Supabase 与 Vercel 生产部署 READY；2026-09-14 生产验收覆盖匿名边界、真实登录/登出/重登、Dashboard、算法/八股训练、AI 分析及持久化（当时版本）。2026-09-18 已应用 AI 计分迁移，新增字段、迁移历史与题库精确计数均验证通过；`02722d0` 部署成功，稳定域名匿名 Smoke 全通过。新版本的认证态训练闭环仍待实际账号复测，不将旧版验收冒充新版验收。
- 最近**已验证的质量门**：2026-09-21 便携 Node 24.19 下 `lint`、`typecheck`、`test`、`build` 全部通过；38 个测试文件、369 项测试、239 个生成页面。`npm` 通过 Node 24 调用同一运行时的 npm CLI，未使用本机旧 Node。

## 2026-09-20 八股答案审校与清洗

- [x] 原始 JSON/CSV 未改；新增按 UUID 审校补丁、可确认推广尾巴裁切与简答机械标点清洗，并接入运行时题库、云端 Seed（源码已写，待执行）。
- [x] 直接审查并持续修订：此前 33 道和上一轮新增 41 道之外，本轮再新增 90 个 UUID：完成并发源书序 101–157 中尚未补丁的 56 道，以及集合源书序 1–37 中 34 道；修正 Semaphore 误 release、CHM 不完整 put 分支、线程池关闭与状态迁移、错误示例代码、ArrayList/LinkedList、fail-fast、HashMap 负数余数及 equals/hashCode 契约等。三种答案和关键点同步，尚未经 Node 测试与上线验证；不把已浏览但未修订的题算作全量完成。
- [x] 保留原文、幂等、推广尾巴、题库数量和 Recall 相关回归用例；本轮继续增加许可证获取失败时不能释放、shutdown 非阻塞、CHM MOVED 与 CAS 分支、集合空 key_points、快照/弱一致与负 hash 位掩码事实测试。审计脚本统计审校总数与剩余数；用例与脚本仍未运行。
- [ ] 执行全量审计、`seed:check`、Node lint/typecheck/test/build；测试 Supabase 备份后 Seed，验证 904/120、差异字段、旧历史与真实 Recall。
- [ ] 所有未进入按 UUID 补丁的题尚未完成逐题技术事实核验；精确剩余数以审计脚本 `stillUnreviewed` 为准。后续继续审查其余答案、关键点和追问，不能把结构/规则扫描当作人工核验，更不能宣称 904 道全部完成。
- [x] 本轮继续人工复核核心 JVM 7 道：内存区域、对象创建/访问、老年代晋升、可达性分析、CMS 生命周期和双亲委派；同步修订四级答案与 Recall 关键点。审计脚本已实际运行，补丁 UUID 数为 287、剩余 617；JSON 解析通过。质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Java 并发剩余 33 道的逐题复核：协程、通信、线程生命周期与中断、ThreadLocal、AQS 公平锁、原子类及死锁；修正 JMM 物理刷新表述、不可中断/强制终止、AQS 公平性、Unsafe 版本边界、线程池上下文和宣传尾巴。审计脚本与补丁 JSON 解析通过，累计 331、剩余 573；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 JVM 剩余 54 道的逐题复核：栈/本地栈、分配、引用、分代 GC、收集器、诊断工具、OOM、类加载、SPI、Tomcat 与热部署；修正固定堆布局、栈上分配、老旧命令、CMS/ParNew 版本和类加载器边界。审计脚本与补丁 JSON 解析通过，累计 385、剩余 519；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Java 集合剩余 20 道的逐题复核：哈希函数/冲突、开放地址与拉链、HashMap 阈值/容量/扩容、JDK7/8 迁移、TreeMap、HashSet；补齐默认负载因子空关键点，移除“随机顺序/最优 0.75/并发安全”等绝对说法。审计脚本与补丁 JSON 解析通过，累计 405、剩余 499；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮继续复核 Java 基础首批 20 道：`this`、抽象类/接口构造器、多继承、抽象类、成员与静态成员、`final`、`equals/hashCode`、类初始化顺序、String 方法与不可变性；同步修订四级答案及 Recall 关键点，补充构造器、访问、哈希碰撞和 JDK 版本边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 441、剩余 463；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮继续复核 Java 基础 17 道：String/StringBuilder/StringBuffer 与场景、字符串池和 `new String`、Integer 缓存、对象比较/拷贝/转字符串、线程调度、反射、GC、异常及 suppressed exception；同步修订四级答案和 Recall 关键点。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 458、剩余 446；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮继续复核 Java 基础 14 道：输入/输出方向、字节/字符流、节点/处理流、I/O 装饰器与适配器、ByteBuffer 边界、文本/视频数据、Java 原生序列化、Serializable、static/transient、自定义序列化、对象图过程和常见格式；同步修订四级答案与 Recall 关键点。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 470、剩余 434；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Java 基础剩余 13 道：Socket、RPC、泛型、通配符、类型擦除、注解、反射原理/应用、Java 8、Lambda、函数式接口和 Optional；同步修订四级答案及 Recall 关键点，补充网络失败、幂等、泛型边界、注解保留策略和 Optional 求值语义。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 483、剩余 421；Java 基础 126/126 进入审校投影，质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 基础前 20 道：数据库与建表、排序、性能诊断、连接类型、范式、建表设计、字符/二进制/时间类型、IN/EXISTS、NULL、金额、emoji、删除语句；同步修订四级答案及 Recall 关键点，补充版本/引擎、三值逻辑、索引计划、字符集和破坏性 DDL 边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 503、剩余 401；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 21–30 的 10 道基础题：UNION/COUNT/逻辑执行顺序、LIMIT/ORDER BY、常用客户端/库表/CRUD/索引约束命令；同步修订四级答案及 Recall 关键点，补充逻辑与物理执行、NULL 计数、参数化 SQL、DDL 锁与破坏性操作边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 513、剩余 391；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 31–44 的 14 道基础/架构题：用户权限、事务控制、bin 目录工具、分页、函数/隐式转换/语法树、基础架构、binlog、查询/更新流程、段区页行和存储引擎切换；同步修订四级答案及 Recall 关键点，补充两阶段提交、版本/配置、资源锁、权限与破坏性命令边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 527、剩余 377；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 45–56 的 12 道 InnoDB/日志题：引擎选择、InnoDB/MyISAM、内存/页/Buffer Pool、默认容量、LRU、日志、binlog 参数、redo/undo/binlog 分工及 redo 机制；同步修订四级答案及 Recall 关键点，保留版本/配置边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 539、剩余 365；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 57–68 的 12 道 redo/WAL 题：redo 容量、WAL、binlog/redo、两阶段提交、XID、写入/刷盘、`innodb_flush_log_at_trx_commit`、未提交 redo、顺序写和内部指针；同步修订四级答案及 Recall 关键点，明确逻辑写入/OS 缓存/持久介质和内部实现边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 551、剩余 353；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 69–80 的 12 道 redo/慢 SQL 题：MTR、redo block/LSN/checkpoint、redo 调优、慢 SQL、执行与优化、慢日志、SQL 优化方法和覆盖索引；同步修订四级答案及 Recall 关键点，补充内部格式、阈值、RPO/RTO、计划/锁/资源证据和索引写放大边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 563、剩余 341；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 81–96 的 16 道索引/分页/连接/排序/EXPLAIN 题：联合索引、分页、JOIN 语义、驱动表、排序/filesort、条件下推、SELECT *、优化方法、EXPLAIN 字段和 type；同步修订四级答案及 Recall 关键点，补充优化器重排、NULL/重复、索引覆盖、估算与实际计划边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 579、剩余 325；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 97–112 的 16 道索引设计题：索引收益/分类、主键/唯一/普通/全文索引、索引使用边界、LIKE、低基数/区分度、适合字段、索引数量和优化思路；同步修订四级答案及 Recall 关键点，补充聚簇/二级、NULL、优化器成本、联合索引和写放大边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 594、剩余 310；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 113–124 的 12 道 B+Tree 题：B+Tree 结构、叶子链、MongoDB 对比、容量/高度/叶子容量、二叉树/平衡树/B-tree/跳表对比、复杂度和范围查找；同步修订四级答案及 Recall 关键点，纠正固定层数/容量、产品树结构绝对化和复杂度脱离 I/O 的表述。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 606、剩余 298；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 125–139 的 14 道索引细节题：快排/Hash、回表与 MRR、联合索引结构和叶子、覆盖索引、建索引场景、最左前缀与范围列；同步修订四级答案及 Recall 关键点，补充 B+Tree/Hash、聚簇/二级、回表成本、InnoDB 主键隐含和优化器计划边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 620、剩余 284；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 140–149 的 10 道联合索引题：最左前缀、联合索引场景、IN/范围条件、LIKE、索引下推、EXPLAIN 和多列条件；同步修订四级答案及 Recall 关键点，区分查找边界、索引扫描、过滤、覆盖和 ICP。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 630、剩余 274；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 150–153 的 4 道锁基础题：锁分类、全局锁、表锁/MDL 和行锁；同步修订四级答案及 Recall 关键点，明确 InnoDB 锁定索引记录/范围、锁粒度与事务边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 634、剩余 270；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 154–163 的 10 道事务锁题：`SELECT ... FOR UPDATE`、记录/间隙/临键锁、意向锁、乐观/悲观锁、库存超卖和死锁；同步修订四级答案及 Recall 关键点，补充事务、autocommit、索引、隔离级别、受影响行数和幂等重试边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 644、剩余 260；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 164–173 的 10 道 ACID 题：事务四大特性、原子性/一致性/隔离性/持久性、ACID 机制和保证方式；同步修订四级答案及 Recall 关键点，区分 undo/redo、MVCC/锁、数据库约束、应用不变量、事务边界与故障模型。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 654、剩余 250；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 174–185 的 12 道隔离/MVCC 题：autocommit、四级隔离、读未提交/已提交/可重复读/串行化、未提交值可见性、隔离级别设置、实现、幻读、避免幻读和当前读；同步修订四级答案及 Recall 关键点，区分快照读/当前读、Read View、记录/范围锁与事务作用域。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 666、剩余 238；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 186–193 的 8 道 MVCC 题：UPDATE/DELETE 当前读、快照读、MVCC、版本链、Read View、版本可见性、RR/RC 快照差异和并发读写分析；同步修订四级答案及 Recall 关键点，补充 undo 版本链、Read View 边界/活跃事务、purge 与事务时间线。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 674、剩余 230；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 194–203 的 10 道复制/分片题：读写分离、实现方式、主从复制、复制延迟、半同步复制、分库/分表、分片策略、不停机扩容和中间件；同步修订四级答案及 Recall 关键点，补充副本接收/应用边界、读后写一致性、CDC/双写追平和迁移回滚。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 684、剩余 220；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 204–213 的 10 道分片/运维/SQL 题：分库分表问题、分布式 ID、Snowflake、大批量删除、大表加字段、CPU 排障、基础查询、分组统计和分组 Top-N；同步修订四级答案及 Recall 关键点，补充在线迁移/DDL、限流排障、参数化 SQL、NULL、窗口函数与并列语义。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 694、剩余 210；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 MySQL 源书序 214–217 的 4 道大表/分页题：大表关联优化、批量导入与索引顺序、深分页；同步修订四级答案及 Recall 关键点，补充连接顺序/索引计划、离线与在线装载取舍、日志/空间/恢复风险和 keyset 分页。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，MySQL 215/215 已进入审校投影；全量累计 698、剩余 206；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Redis 源书序 1–12 的 12 道基础/数据结构题：Redis 定位、MySQL 对比、项目场景、部署/高可用、用途、核心类型、string/list/hash/set/zset；同步修订四级答案及 Recall 关键点，补充持久化/复制/淘汰、TTL、原子性、内部编码与大集合成本边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 710、剩余 194；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Redis 源书序 13–24 的 12 道特殊类型/性能题：Bitmap、HyperLogLog、GEO、hash/string 取舍、Redis 性能、I/O 多路复用、select/poll/epoll/kqueue/IOCP、事件循环、单线程和 Redis 6 网络 I/O 多线程；同步修订四级答案及 Recall 关键点，补充近似统计、内存/大 key、readiness/completion、慢命令和网络 I/O 边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 722、剩余 182；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Redis 源书序 25–29 的 5 道命令/性能题：常用命令、SET、SADD 复杂度、INCR 和 QPS；同步修订四级答案及 Recall 关键点，补充条件写入/TTL、集合扩容、整数与复合原子性、压测变量和尾延迟边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 727、剩余 177；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Redis 源书序 30–36 的 7 道持久化题：RDB/AOF/混合持久化、RDB 快照与触发、AOF 与刷盘、AOF rewrite 机制和具体流程；同步修订四级答案及 Recall 关键点，区分快照/命令日志、fsync/RPO、fork/COW、增量缓冲和原子切换。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 734、剩余 170；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Redis 源书序 37–44 的 8 道持久化恢复/配置题：AOF 内容、rewrite 期间双写、RDB/AOF 优缺点与选型、数据恢复、混合持久化、模式设置和开发配置；同步修订四级答案及 Recall 关键点，补充 RESP 命令日志、恢复优先级、RPO/RTO、版本/配置、开发与生产边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 742、剩余 162；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Redis 源书序 45–57 的 13 道复制/Sentinel 题：主从复制、作用、不一致与修复、拓扑、全量/增量同步、复制问题、脑裂、Sentinel、故障转移 leader 和新主选择；同步修订四级答案及 Recall 关键点，补充 replication ID/offset/backlog、quorum/epoch、脑裂隔离、数据校验与客户端切换。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 755、剩余 149；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Redis 源书序 58–71 的 14 道 Cluster/缓存保护题：Cluster、槽位分区、动态伸缩、MOVED/ASK、缓存击穿/穿透/雪崩、布隆过滤器及误判/删除/哈希表对比；同步修订四级答案及 Recall 关键点，补充 slot/迁移/客户端路由、三类缓存故障边界、概率结构与误判治理。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 769、剩余 135；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Redis 源书序 73–82 的 10 道缓存一致性/热点题：删除或更新缓存、先写库后删缓存、高一致性、本地/分布式二级缓存、缓存组件设计、本地缓存对比、热 Key 监控/治理和大 Key；同步修订四级答案及 Recall 关键点，补充并发回填、可靠失效事件、L1/L2、热点拆分和大对象扫描/删除边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 779、剩余 125；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Redis 源书序 83–91 的 9 道缓存/队列题（源书序 92 无待审投影）：缓存预热、无底洞、内存不足、过期/淘汰、LRU/LFU、阻塞、异步消息队列和延时队列；同步修订四级答案及 Recall 关键点，补充限速预热、fan-out、内存排查、淘汰边界、Streams 确认和 zset 延迟任务幂等。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 788、剩余 116；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Redis 源书序 93–102 的 10 道事务/Lua/Pipeline/锁题：事务原理与边界、回滚/ACID、Lua、Pipeline、底层流程、使用场景和分布式锁；同步修订四级答案及 Recall 关键点，区分不交错执行与回滚、Pipeline 与事务、脚本阻塞、批量背压、锁 token/续期和 fencing。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 798、剩余 106；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Redis 源书序 103–110 的 8 道分布式锁题：SETNX 竞争、SETNX 风险与改进、Redisson、看门狗原子性、Redlock、红锁边界和项目落地；同步修订四级答案及 Recall 关键点，补充 token/TTL/续期、客户端暂停/故障切换、fencing、强一致协调和如实项目描述。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 806、剩余 98；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Redis 源书序 111–124 的 14 道底层结构题：SDS、dict、链表/intset、zset、listpack/ziplist 连锁更新、跳表/span 和范围查询；同步修订四级答案及 Recall 关键点，按版本区分紧凑编码、quicklist、dict/skiplist，纠正把历史源码结构和期望复杂度绝对化。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，累计 821、剩余 83；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Redis 源书序 125–134 的 10 道底层/工程题：span/range、ziplist/listpack、quicklist、LZF、前缀扫描、秒杀、削峰和限流；同步修订四级答案及 Recall 关键点，补充版本边界、SCAN 幂等、队列/消费、库存事实源、积压和限流算法。Redis 源书 134/134 已进入审校投影；便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，全量累计 830、剩余 74；质量门、Seed、真实 Recall 和部署仍未运行。
- [x] 本轮完成 Spring 源书序 1–9 的 9 道框架基础题：Spring 定位与特性、AOP/IoC、源码刷新主线、模块、常用注解、设计模式、容器单例和 Spring/Web 容器边界；同步修订四级答案及 Recall 关键点，明确 Boot/Cloud 与 Framework 的边界、代理自调用、BeanFactory 作用域和 Web 容器职责。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，全量累计 839、剩余 65；审计仍有 5 个长答/编辑性候选待处理，质量门、Seed、真实 Recall 和部署仍未运行。下一步继续 Spring IoC 与 Bean 生命周期。
- [x] 本轮完成 Spring 源书序 11–20、22–26 的 13 道 IoC/Bean 题：IoC 与 DI、使用收益、实现机制、理解 IoC、手写容器边界、BeanFactory/ApplicationContext、启动流程、实例化方式、Bean 定义、@Component/@Bean、Aware、初始化/销毁、构造器注入、@Autowired/@Resource 和 Autowired 处理器；同步修订四级答案及 Recall 关键点，补充作用域、FactoryBean、后置处理器、循环依赖、prototype 销毁和版本边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，全量累计 854、剩余 50；审计候选降至 4 个，质量门、Seed、真实 Recall 和部署仍未运行。下一步继续 Spring AOP、生命周期和 Web。
- [x] 本轮完成 Spring 源书序 27–39 的 12 道自动装配/作用域/循环依赖/AOP 题：自动装配类型、Bean 作用域、单例线程安全、循环依赖与三级缓存、AOP 核心概念和代理/织入方式；同步修订四级答案及 Recall 关键点，补充 XML 旧模式、scoped proxy、无状态设计、构造器循环限制、早期代理和 AspectJ 编译/加载期边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，全量累计 866、剩余 38；审计候选降至 3 个，质量门、Seed、真实 Recall 和部署仍未运行。下一步继续 Spring AOP 通知、事务和 MVC。
- [x] 本轮完成 Spring 源书序 40–58 的 16 道 AOP/事务题：AspectJ、通知类型与执行时机、AOP 总结/OOP 关系、Spring AOP 与 AspectJ/反射、JDK/类代理、代理选择与示例、事务理解/实现、失效场景、隔离级别、传播机制、跨线程、protected/private 边界；同步修订四级答案及 Recall 关键点，压缩长答并明确代理、异常回滚、线程绑定、数据库实现和版本配置边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，全量累计 884、剩余 20；审计候选降至 1 个，质量门、Seed、真实 Recall 和部署仍未运行。下一步继续 Spring MVC、Boot 及剩余题。
- [x] 本轮完成 Spring 源书序 59–64、66–72 的 13 道 MVC/Boot 题：MVC 核心组件、请求流程、HandlerAdapter、REST、Boot 定位/注解/Starter/自动配置/启动/主类/扫描路径、Boot 与 MVC/Spring 区别；同步修订四级答案及 Recall 关键点，明确组件扫描与自动配置、Boot 与 Framework/MVC 层次、starter 导入和 REST 消息转换边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，全量累计 897、剩余 7；审计候选已降为 0，质量门、Seed、真实 Recall 和部署仍未运行。下一步完成 Spring Cloud/微服务/任务/缓存及剩余 7 题。
- [x] 本轮完成 Spring 源书序 73–79 的 7 道 Cloud/微服务/任务/缓存题：Spring Cloud 定位、微服务边界、SpringTask 调度与替代方案、Spring Cache、Cache 与 Redis 分层和共存理由；同步修订四级答案及 Recall 关键点，补充版本/BOM、分布式失败、集群幂等、队列背压、缓存一致性和抽象层边界。便携 Node 24 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过，全量累计 904、剩余 0；审计候选为 0，进入全量报告、Seed 检查和质量门验收，数据库 Seed、真实 Recall 和部署仍未运行。
- [x] 全量审校报告与 Seed 预演通过：便携 Node 24.19 下 `npm run knowledge:audit:report` 报告 904/904 人工审校、0 未审、0 候选，生成 `output/knowledge-audit.json`；`npm run seed:check` 验证 100 算法、165 主题、904 题、120 核心题和 904 条清洗详答。随后质量门首次暴露 `tests/knowledge-content-cleaning.test.ts:208` 回归用例缺少 `=>`，已做最小语法修复；lint/typecheck/test/build 需重跑，数据库 Seed、真实 Recall 和部署仍未运行。
- [x] 修复全量题库接入的 TypeScript 联合类型与回归测试假设：为 `lib/knowledge/catalog.ts` 的 JSON 源题目显式收敛 `ReviewableQuestion` 及元数据类型，更新测试对当前 CAS/HashSet/JIT 文案的断言，并将“必须存在未审题”改为元数据不变性断言；仍需重跑 lint/typecheck/test/build，数据库 Seed、真实 Recall 和部署仍未运行。
- [x] 全量验收质量门通过：便携 Node 24.19 下 lint、typecheck、test、build 全部通过；38 个测试文件、369 项测试、239 个生成页面。此前 `knowledge:audit:report`、`seed:check` 已通过；数据库 Seed、真实账号 Recall/刷新回归和部署仍未运行。

## 2026-09-20 优化方案第 3 项：八股 Recall 历史对比（源码完成，待验收）

- [x] 复用已有 Knowledge Attempt 的 `aiAnalysis`、确定性关键点及分数，不重新建表、不复做 `ai_analysis` Migration、不改旧 Attempt/Mastery/复习日期。`lib/knowledge/recall-history.ts` 按题目和 Attempt ID 去重、排序并对比最近两次 Recall。
- [x] `components/knowledge/recall-history-panel.tsx` 展示连续遗漏、新遗漏、补齐点和一条聚焦提示；历史 AI 复核从已保存 Attempt 恢复，使用记录中的原始关键点文本，无法对应当前版本的不误报为新遗忘。至少一条历史缺少可用 AI 时，两次统一使用确定性口径。
- [x] 训练页接入：最新一次提交和页面刷新均能从持久化 Attempt 构建历史；区分提交时已保存/计分的 AI 与提交后临时补做的 AI，后者不冒充已落库结果。
- [x] 新增 `knowledge-recall-history.test.tsx`、浏览器 Demo 持久化及 Supabase Snapshot 重载测试用例，覆盖补题/漏题差异、重复 ID、题库关键点改名、AI 降级和刷新展示；仅写入文件，尚未执行。
- [ ] 执行 `npm run lint && npm run typecheck && npm run test && npm run build` 并修复失败；当前 mac-host 连接仅有文件接口，无法执行终端命令。
- [ ] 真实账号验证同题至少两次 Recall → 提交后对比 → 浏览器刷新、退出重登、切换题目、Demo/SQLite/Supabase 三模式一致性；核实其他 Agent 的题库修订导致关键点变化时显示“不可比较”而不误报。
- [ ] 既有暂停计划迁移与增量写入回归通过后再部署；此项不需要新的 SQL Migration，不把编写测试视为测试通过。

## 2026-09-21 优化方案第 4 项：连续下一题（源码完成，待验收）

- [x] 新增 `lib/progress/next-task.ts`，统一选择 Algorithm / Knowledge 的下一任务：优先当前训练日未完成项，再取最早历史 backlog，最后按 `nextReviewAt` 取到期复习；始终排除刚完成的当前题和已完成任务。
- [x] Knowledge Learn/Recall 提交完成页接入直接导航。Learn 在同一任务层级优先 `taskType='new'`，正常连续新学显示「学习下一题」；若转入复习/欠账则使用对应文案，不伪装成新学。
- [x] Algorithm 完成反馈页接入同一选择器；保留「再刷一次」与返回列表，不自动跳转，用户仍可先查看 AI 复盘和结果。
- [x] 暂停兼容：组件同步 profile pausePeriods；暂停时允许已有任务/历史 backlog 继续下一题，到期兜底只接受暂停开始前已经逾期的 state，不把休息期间新到期复习提前拉进来。
- [x] 动态 `/knowledge/[id]` 与 `/algorithm/[id]` 给训练组件加 item ID `key`，避免客户端切下一题时复用上一题 submission/completion/timer/AI 临时状态。
- [x] 新增 `tests/next-training-task.test.ts`，覆盖今日队列排序、Learn 优先新学、最早欠账、到期兜底、暂停边界和不重复当前题；首轮运行已通过 39 个测试文件、378 项测试，lint 发现并修复组件中直接调用 `Date.now()` 的 purity 规则问题，改为组件时钟定时更新。
- [ ] 优化路线第 4 项其余内容仍待完成：Dashboard 一键继续、今日预计工作量、日终总结。
- [x] 重跑 `npm run lint && npm run typecheck && npm run test && npm run build`：便携 Node 24.19 下全部通过，39 个测试文件、378 项测试、239 个页面；真实账号验证 Learn → 下一题、Recall → 下一题、Algorithm → 下一题、暂停欠账 → 下一题和浏览器前进/后退状态仍待进行。

## 2026-09-20 暂停计划功能验收清单

- [x] Settings 一键暂停/恢复，Dashboard 显示状态与恢复入口；浏览器 Demo、SQLite 和 Supabase 持久化路径已编写（未执行验收）。
- [x] Planner 与进度函数已编写：暂停日期不生成新任务、不计漏训、不推进六周进度；恢复日按有效训练日继续（未执行验收）。
- [x] 2026-09-21 修复“暂停后无法还欠账”：算法/八股 ensure 在暂停时仍补出暂停前有效训练日的历史缺口，但不创建暂停日任务；Dashboard 暂停时继续展示旧欠账入口；只统计暂停开始前已经逾期的复习，休息期间新到期复习仍等待恢复后顺延。浏览器 Demo/SQLite/Supabase 共用同一 ensure 路径，完成事务原本就会结清同题未完成任务。
- [x] 新增暂停回归：暂停日不生新任务、历史算法/八股 backfill 可在暂停期间完成、完成后不生成暂停日任务、暂停前逾期仍可见而暂停期间新到期不计入欠账。用例已写入，当前文件连接无命令执行能力，尚未实际运行。
- [ ] Node 24 全量质量门、测试库 Migration 及真实登录态验收通过后才允许上线。

## 2026-09-20 第二轮优化验收清单

- [x] 常规算法写入与八股提交改为返回轻量结果，不再调用全量 `loadCloudTrainingSnapshot()`（代码已写入，尚待验证）。
- [x] 客户端增量合并活跃/历史 Attempt、Mastery、关联日任务；同一响应重复合并不追加重复 Attempt（代码已写入，尚待验证）。
- [x] 新增增量合并、幂等和路由不全量加载的回归用例；加入防止旧刷新覆盖新状态的版本检查（仅编写，未运行）。
- [ ] Node 24 运行 lint、typecheck、test、build，修复所有失败；真实账号验证开始/取消/完成/AI 分析、Knowledge Learn/Recall、重复提交及刷新持久化。
- [ ] 后续：首次 Snapshot 分离按需分页历史、AI 每用户配额、请求校验统一；本轮不提前宣称完成。

## 2026-09-20 第一轮修复验收清单

- [x] 算法和八股训练日期改按 profile 当地墙上时钟 03:00 判定，周次复用同一个训练日期键；真实到期时间不受影响。
- [x] 增加洛杉矶和伦敦夏令时跳变、八股侧跨日回归测试用例（用户称已测试；当前连接未取得执行明细）。
- [x] 新增 `202609200001_daily_task_idempotency.sql`：用户/日期/算法或八股类别锁；已有当天同类任务优先；原子插入后返回数据库实际任务。训练适配器不再忽略批量 INSERT 的 23505 错误。
- [x] 新增并发抢先落库与 RPC 缺失的适配器测试用例（用户称已测试；当前连接未取得执行明细）。
- [x] 同步 README、AGENTS、AI 复核提示词；明确现有个人版信任用户自己分数的边界。
- [ ] 用户反馈已完成第一轮测试；需补录 lint/typecheck/test/build 具体结果与 diff 检查记录，才标为可审计的验收。
- [ ] 在测试 Supabase 先备份并预演、应用新迁移，实际双会话验证同日同类任务仅生成一次，且返回任务与数据库一致；验证匿名与其他用户不能获取任务。
- [ ] 确认新迁移已经应用后部署 Next.js；生产真实账号复测 Algorithm/Knowledge 完整训练、刷新持久化和匿名 Smoke。
- [ ] 决定是否将个人训练升级为不可篡改成绩系统；若需要，另行设计受信评分存储、RLS 写权限收缩和 AI 分数的服务端来源验证。

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
| Phase 8 | 已完成 | 本地与云端训练闭环就绪；生产 Smoke 全部通过，V1 最终验收完成 |

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
- mastery 只由确定性 TypeScript 规则更新；AI 分析不得直接修改 mastery。（2026-09-17 补充：AI 语义分现在作为该 TS 规则的**输入**参与计分，但模型仍然不直接写 mastery，落库与掌握度计算全部由 TypeScript 规则完成。）
- 八股 Recall 保留确定性关键词分数，并允许用户提交后主动请求 AI 语义复核；AI 结果只用于解释，不回写 mastery。（**2026-09-17 修订**：用户报告规则匹配对自由复述理解不足、打分明显偏低，确认这是真实缺陷而非展示问题，计分口径改为 AI 主导，见下条。）
- 2026-09-18 起每日任务重置时刻为**profile 时区当地凌晨 3 点**（`DAILY_RESET_HOUR = 3`）；2026-09-20 修复夏令时：`getAlgorithmTrainingDateKey()` 读取当地小时及日期、必要时将日历日期减一天，不再通过 UTC 时间戳减三小时实现。周次和任务日期复用同一日期键；纯 `YYYY-MM-DD` 原样返回。复习到期判定及时间戳仍按真实时刻。
- 2026-09-17 起八股 Recall 计分改为 **AI 主导 + 确定性下界**：`effectiveCoverageScore = max(确定性加权覆盖率, AI 语义覆盖)`；`semanticScore` 为 null 时退化为确定性覆盖。此公式仅保证 AI 不会降低确定性得分，**不能防止 AI 高估**，须通过标注样本校准。mastery、下次复习与 `lastRecallCoverageScore` 使用 `effectiveCoverageScore`。
- AI 复核改为**提交时同步执行**：前端先调用 `/api/ai/analyze-recall`，成功则把分析随提交一起写入，单次落库、不设提升端点；AI 不可用时按确定性分计分并在界面明确告知，不阻塞提交、不丢回答。AI 分析作为 `ai_analysis` 落库，同时补齐优先级 3 的持久化缺口。
- Attempt 三个分数分离记录，便于后续校准：`coverage_score` 保持确定性口径不变，`ai_analysis.semanticScore` 为语义口径，新增 `effective_coverage_score` 记录**当次实际计分所用的覆盖率**（读取时对旧行回退为 `coverage_score`）。历史 Attempt 不回填、不重算，新规则只对之后的提交生效。
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
- 漏训日若从未生成任务，下一次加载时按当前计划配额、当前已学状态及教学顺序为该日期**补排**具体新学题，并在界面明确标记为补排；不可伪称它们曾在当天生成。原有任务和历史 Attempt 不改写，逾期复习仍按真实到期时刻单独统计；已学或已分配的题不可重复补排。
- 补排任务的 `date` 是原计划日期，`completedAt` 是实际完成时刻；漏训日与连续训练按实际完成的训练日计算，不因事后补题而伪造过去的签到。所有待补题完成后，单独保留的历史漏训天数不再让 Dashboard 继续显示“待补齐”警示。
- 外部已完成算法题允许按题号、`[题号]题名` 或 LeetCode 链接批量导入；导入题以 60% 保守掌握度进入学习状态、3 天后复习，不伪造训练 Attempt，也不覆盖已有 OfferPilot 记录。
- 2026-09-17 起八股 Recall 支持语音输入：录音在浏览器本地完成，转写走服务端百炼 `qwen3-asr-flash`（OpenAI 兼容 `/chat/completions` + `input_audio` Data URL），复用现有 `OPENAI_API_KEY` / `OPENAI_BASE_URL`，不注入浏览器；前端统一把录音转成 16kHz 单声道 WAV 再上传，原始音频不落盘、不入库，只保存用户确认后的文本。个人用量在百炼 10 小时/月免费额度内，成本约等于 0。
- 语音输入只做八股 Recall 一处；算法训练不新增语音与笔记字段，避免扩大改动面。
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
- [x] 关闭 `LOCAL_DEMO_MODE`，联调真实注册、邮箱确认、登录、退出和 RLS 隔离。
- [x] 在 Vercel 配置生产环境变量并部署 Next.js 前端。
- [x] 支持批量导入外部已完成的 Hot 100 题目，并在本地数据库与 Supabase 共用同一语义。
- [x] 接入 OpenAI 兼容的八股 Recall AI 语义复核，服务端读取题库、严格校验结构化结果且不修改 mastery。
- [x] 优化算法写题流程：未提交代码草稿自动恢复，训练记录先保存，AI 复盘后执行并独立持久化。
- [x] 支持取消尚未完成的算法训练，不改变历史成绩与 Mastery，并恢复对应待办状态。
- [x] 支持计时期间在训练页直接编写 Java 代码，刷新恢复并自动带入反馈。
- [x] 为全部 Hot 100 训练页展示静态题面并在新 Attempt 自动填入 Java 初始代码，支持确认后恢复模板且保护已有草稿。
- [x] 将算法训练详情优化为桌面题面/编辑器双栏工作台，移动端训练优先且题面可折叠，计时、反馈与状态信息保持紧凑可见。
- [x] 完成生产 Smoke Test、README 和恢复/排错说明。（2026-09-14 真实生产执行通过）
- [x] 运行完整质量门并完成 V1 最终验收。

## Phase 8 验收记录

2026-09-14 生产 Smoke（稳定域名 offerpilot-dun.vercel.app，经本机代理绕过 DNS 污染）：

- 匿名边界：`scripts/smoke.mjs` 全部通过（登录页 200、受保护页 307 跳登录、5 个训练 API JSON 401、未知页边界）。
- 登录态闭环（临时验收账号）：登录跳转、Dashboard 渲染（Day 2/42、今日任务 2+3）、刷新后会话保持、算法开始计时/断线恢复（刷新续接计时）/二次确认取消（服务端 Attempt 撤销、任务恢复 pending）/草稿自动保存与刷新恢复（404 字符 HashMap 解法）/保存反馈（Mastery 0→93，下次复习 2026-09-28）/AI 代码复盘（哈希解法、O(n) 复杂度、思路小结、3 张 Java 基础语法卡片）；知识 Learn（自评 45，下次复习 2026-09-17）/Recall（答案默认隐藏、确定性覆盖 14%、Mastery 33、下次复习 2026-09-16）/AI 语义复核（语义覆盖 100% 且不修改确定性 mastery）。
- 持久化：登出→重登后 Dashboard 完成数、算法 Mastery/累计/复习日、知识 Mastery/Learn/Recall 次数与复习日全部保留。
- 发现的阻塞：Vercel→Supabase 网关间歇 504（实测失败率约 10%），导致训练 API 500 与页面渲染挂起；已通过 `resilient-fetch` 修复并部署，修复后 12/12 探测成功。
- 临时验收账号与临时诊断脚本已在验收后删除。

## V1 最终验收

- [x] Algorithm 完整闭环：开始 → 计时 → 反馈 → score → mastery → next review → 到期重入 → 二刷更新。（本地 Demo 已验收）
- [x] Knowledge 完整闭环：Learn → 初始 mastery → 到期 → Recall → matched/missing → mastery → next review。（本地 Demo 已验收）
- [x] 连续模拟 7 天，能够区分已掌握、假会、薄弱类型和到期任务。（确定性测试已验收）
- [x] 同日重复生成 Daily Tasks 不重复。（本地存储与云端唯一约束/事务契约已验收）
- [x] 每个用户只能访问自己的 profile、attempt、state 和 task。（真实双用户远端验证通过）
- [x] 公共题库只允许 authenticated read。（真实匿名/认证远端验证通过）
- [x] 本地和生产均通过完整质量门。（本地 Node 24 全部通过；生产 Smoke 于 2026-09-14 通过）

## V1 后优化路线

- [x] Knowledge Recall 提交后在匹配结果前展示只读的本次原始回答，保留换行；空回答明确显示“本次选择：想不起来”，不修改已保存 Attempt。
- [x] Dashboard 欠账准确性：计划起点后的未打开日期也能识别漏训；分开展示逾期复习、累计新学进度缺口和漏训天数，且重设起点后不继承起点前欠账。
- [x] 欠账入口正确性：算法复习按钮直达待复习筛选，八股复习按钮直达全部到期题（不受今日配额限制），列表与 Dashboard 的到期数量一致；新学缺口可直达未学题。（2026-09-16 完成，质量门全绿）
- [x] 正确性阻塞：漏训日补排具体新学题，欠账入口直达按原日期列出的待补题；完成后消账，重复加载无重复分配，本地 Demo/SQLite/Supabase 均持久化；不篡改已生成任务、Attempt 或独立的逾期复习。便携 Node 24 下 lint/typecheck/test/build 全通过（34 文件、328 测试、239 页面）。
- [x] 八股 Recall 语音输入：录音、服务端转写、结果追加进回答框，复用服务端密钥边界与有界超时，不改变提交语义与 Attempt 结构。（2026-09-17 完成，真实转写验证通过）
- [x] 八股 Recall 计分改为 AI 主导 + 确定性下界：`effectiveCoverageScore = max(确定性加权覆盖率, AI 语义覆盖)`，mastery/下次复习据此更新；Attempt 分列记录确定性覆盖、语义覆盖与实际计分覆盖率；历史 Attempt 不回填。配套迁移 `202609170001_knowledge_ai_scoring.sql`（两个可空列 + RPC 追加带默认值的参数）。（实现完成、质量门通过；**待应用迁移后部署**）
- [x] 算法训练页 Java 编辑器 Tab 缩进：Tab/Shift+Tab 在编辑区内缩进与反缩进，不再把焦点移出输入框；Ctrl/Alt/Meta+Tab 与"Esc 后 Tab"仍可正常离开编辑器。（2026-09-17 完成）
- [x] 八股 Recall 两个分数口径显式化：并列展示「加权覆盖率（确定性匹配，已计入 Mastery 与下次复习）」与「语义覆盖（AI 复核，仅供参考，不改变 Mastery）」，并说明两者差异原因，消除“AI 复核后分数没生效”的误判；计分语义与 Attempt 结构保持不变。（2026-09-17 完成）
- [ ] 优先级 2：完成 120 道核心题的原子关键点、别名、口语等价与期望匹配/误报回归集。
- [ ] 优先级 3：将 Knowledge AI 语义复核附加到对应 Recall Attempt，并支持刷新后恢复与历次遗漏对比。

## 明确不做

- 岗位抓取、投递管理、面试管理。
- BOSS、智联、51Job、Chrome/IDEA 插件、LeetCode 自动同步。
- 语音口试（发音评分、对话式口试）、社交、排行榜、金币等游戏化功能。2026-09-17 起例外：八股 Recall 允许“语音转文字”输入，仅做转写填入回答框，不做发音评价、不做语音对话。
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
| 2026-09-13 | Phase 8.5 | 将 Hot 100 静态题面与 Java 初始代码改造提交并推送到 `main`，由 Vercel Git 集成自动部署 | Commit `1744299` 已推送且远端 `main` 一致；部署 `dpl_HCm54m45rxRwbWp4h78aX3wiycmM` 状态 READY，稳定域名已切换到新版本 |
| 2026-09-13 | Phase 8.5 | 优化算法训练详情布局：桌面端改为题面 40% / 训练区 60% 的双栏独立滚动工作台，移动端训练区优先并使用原生折叠题面；掌握度、状态、累计刷题和下次复习合并为紧凑状态条，未开始时直接预览 Java 模板 | 桌面与 390px 移动端浏览器验收通过，无横向溢出且移动端训练区位于题面前；Node 24 下 lint/typecheck/test/build 全通过，28 个测试文件、259 项测试、238 个页面 |
| 2026-09-13 | Phase 8.5 | 将算法训练双栏工作台优化提交并推送到 `main`，由 Vercel Git 集成自动部署 | Commit `f7f7b59` 已推送且远端 `main` 一致；部署 `dpl_G9N7SC556NyEScdwxzf5TTuH7f4S` 状态 READY |
| 2026-09-14 | Phase 8.5 | 生产 Smoke 突破本机网络阻塞（vercel.app 遭 DNS 污染，经本机代理 127.0.0.1:7897 验证）：匿名 Smoke 全部通过，真实登录、Dashboard、算法列表/详情静态题面渲染通过；发现算法 Start 返回 500，Vercel 日志定位为 Vercel→Supabase 网关间歇 504（实测失败率约 10%），训练读/写与页面渲染均受影响 | 匿名 Smoke 通过；临时验收账号登录与页面渲染通过；新增 `node_modules` 内临时诊断脚本（不入库） |
| 2026-09-14 | Phase 8.5 | 新增 `lib/supabase/resilient-fetch.ts`：服务端 Supabase 请求统一 8 秒超时，对 408/429/502/503/504 与网络错误做两次退避重试（读操作与按合同幂等的训练写安全）；接入 `lib/supabase/server.ts` 与 `proxy.ts` 客户端；`loadProfile` 对并发首载唯一冲突改为复用既有行 | 新增 7 项回归测试；便携版 Node 24.21 下 lint/typecheck/test/build 全通过，29 个测试文件、266 项测试 |
| 2026-09-14 | Phase 8.5 | 弹性重试修复部署 READY（`7f69316`），修复后 12/12 端到端探测成功；随后完成登录态生产闭环验收：算法开始/恢复/取消/草稿恢复/反馈（Mastery 93）/AI 复盘、知识 Learn（45）/Recall（14%）/AI 语义复核（100%）、登出重登后全部数据持久化；Phase 8 与 V1 最终验收完成，临时账号与诊断脚本清理 | 生产 Smoke 全部通过；Node 24 下 29 个测试文件、266 项测试通过 |
| 2026-09-16 | 优先级 2 | Knowledge Recall 结果区增加只读“我的回答”卡片，直接复用已持久化的 `answerText` 并保留换行；选择“想不起来”时显示明确文案，匹配、Mastery 与 Attempt 数据结构保持不变 | 新增 2 项独立渲染回归；Codex bundled Node 24.19 下 lint/typecheck/test/build 全通过，30 个测试文件、268 项测试、238 个页面 |
| 2026-09-16 | 正确性阻塞 | 修复 Dashboard 欠账漏算未打开日期：在第一周期内按计划配额与实际已学数计算算法/八股新学进度缺口，单独统计有计划任务但无任何完成记录的漏训日，并继续分开展示逾期复习与已生成遗留任务；重设起点仍隔离旧欠账 | 9 月 13 日完成、14 日无任务记录的回归通过；Node 24.19 下 lint/typecheck/test/build 全通过，30 个测试文件、271 项测试、238 个页面 |
| 2026-09-16 | 正确性阻塞 | 修复“点欠账入口后找不到对应题目”：算法入口改为 `/algorithm?filter=due#problems` 并支持 URL 初始筛选（含 `key` 保证同路由二次跳转确定性重置），八股新增“全部到期复习 / 可补核心新学”两个锚点区块，四个欠账按钮按指标是否大于 0 分别显示并直达对应题单；抽出 `isReviewDue()` 统一 Dashboard 欠账统计、算法列表与详情状态的到期判定，已掌握但再次到期不再被“待复习”筛选漏掉 | Node 22.22.2 下 lint/typecheck/test/build 全通过；30 个测试文件、272 项测试、238 个页面；新增到期口径回归 1 项 |
| 2026-09-17 | 语音输入 | 新增八股 Recall 语音输入：浏览器 `MediaRecorder` 录音后本地转 16kHz 单声道 WAV（新增 `lib/audio/wav.ts` 纯函数），经新增受认证路由 `/api/ai/transcribe` 调百炼 `qwen3-asr-flash`（OpenAI 兼容 `/chat/completions` + `input_audio` Data URL）；服务层复用现有 AI 错误类型、30 秒有界超时、base64 与格式校验，密钥不出服务端；转写文本追加进回答框（不覆盖已有文字），录音期间禁用提交，不改变 Attempt 结构与 mastery 链路。同时把 `/api/ai/transcribe` 与漏掉的 `/api/ai/analyze-recall` 纳入 Smoke 匿名边界清单 | lint/typecheck 通过；33 个测试文件、297 项测试通过；`next build` 成功并注册 `/api/ai/transcribe`；真实百炼调用返回 `"欢迎使用阿里云。"`，确认 base URL、模型名、请求体与响应解析契约正确 |
| 2026-09-17 | 展示修复 | 用户报告“AI 复核后分数没应用到真正得分”。核对确认为既定决策（mastery 只由确定性规则更新），真实缺陷是界面未说明两个分数的口径关系：新增 `RecallScoreComparison` 并列展示加权覆盖率（计入 Mastery）与语义覆盖（仅供参考），写明差异原因，并在复核入口文案中明确“本次 Mastery 仍以确定性覆盖率为准”；`RecallAiPanel` 增加 `coverageScore` 入参；计分语义、Attempt 结构与数据库保持不变。另确认 AI 复核结果仍未持久化（`knowledge_attempts` 无 `ai_analysis` 列），属路线图优先级 3 的已知缺口 | 目标渲染回归新增 3 项；lint/typecheck 通过；33 个测试文件、300 项测试通过；`next build` 成功 |
| 2026-09-17 | 计分口径 | 八股 Recall 改为 AI 主导计分：新增 `combineRecallCoverage`，`effectiveCoverageScore = max(确定性加权覆盖率, AI 语义覆盖)`，mastery、下次复习与 `lastRecallCoverageScore` 全部改用该值；确定性覆盖与 AI 语义覆盖分列落库（`coverage_score` / `ai_analysis.semanticScore` / 新增 `effective_coverage_score`），历史行保持 null 且读取时回退，不回填不重算。AI 复核改到提交时同步执行：前端先调 `/api/ai/analyze-recall` 再单次落库，AI 不可用时按确定性分计分并明确告知，补救复核只补解释不改分。新增迁移 `202609170001_knowledge_ai_scoring.sql`，两个新 RPC 参数带默认值以便迁移对旧前端也兼容 | lint/typecheck 通过；34 个测试文件、316 项测试通过；`next build` 成功。**待应用迁移后部署** |
| 2026-09-17 | 编辑器 | 算法训练页 Java 编辑器支持 Tab 缩进：新增纯函数 `lib/editor/tab-indent.ts`（光标处插入一个缩进宽度；反缩进只移除光标前真实存在的空白且不越过行首；多行选区整块伸缩并保持选区）。组件对纯插入走 `setRangeText` 以免 React 重置光标，其余情况走状态更新 + 一次性光标恢复；保留 Ctrl/Alt/Meta+Tab 与"Esc 后 Tab"的键盘退出路径 | 新增 11 项目标测试；lint/typecheck 通过；34 个测试文件、316 项测试通过；`next build` 成功 |
| 2026-09-18 | 任务重置 | 每日任务重置时刻改为按 profile 时区**凌晨 3 点**：新增 `DAILY_RESET_HOUR`、`shiftToTrainingDay()` 与 `getAlgorithmTrainingDateKey()`；任务生成（算法/八股 ensure）、今日任务挑选（算法列表/Dashboard/八股总览）、连续天数与周期位置、欠账与缺失日统计、以及开始训练时写入的 `p_task_date` 全部改用训练日口径；确保函数的日期键与周次同时按训练日计算，避免凌晨出现"任务记在昨天、周次已翻新周"的错配。计划开始日与 profile 校验仍用无偏移的 `getAlgorithmDemoDateKey()`。到期判定与所有时间戳保持真实时刻 | 新增边界回归 5 项（00:30/02:59:59 归前一天、03:00 归当天、纯日期不偏移、周次与训练日对齐、八股侧一致）；lint/typecheck 通过；34 个测试文件、324 项测试通过；`next build` 成功 |
| 2026-09-18 | 正确性阻塞 | 为未生成任务的漏训日按原计划日期补排具体算法/八股新学题，复用现有任务表并持久化 `backfill` 来源；按当前已学进度减去原有待完成任务，避免重复分配已学、旧日或今日已分配题。Dashboard 新学欠账入口直达原日期题单，标明“补排”；完成题目消除对应待办，逾期复习仍独立。漏训天数和连续训练改按实际完成日计算，事后补题不伪造历史签到；无待办后不再仅因历史漏训日显示警示 | 浏览器 Demo、SQLite 与 Supabase 适配层回归覆盖；便携 Node 24 下 lint/typecheck/test/build 全通过，34 个测试文件、328 项测试、239 个生成页面；2026-09-18 只读探测确认生产库仍缺 `effective_coverage_score` 列，故只本地提交、暂不推送 `main`，待 AI 计分迁移应用后再部署 |
| 2026-09-18 | 生产迁移 | 用户授权后，Supabase CLI 核对链接项目为 OfferPilot、预演确认唯一待执行迁移 `202609170001_knowledge_ai_scoring.sql`，跳过 Vault/种子/角色并应用；再次查询迁移历史、`effective_coverage_score` / `ai_analysis` 字段及题库精确计数 | 迁移成功，远端 up-to-date；题库 100 / 165 / 904 / 120，精确 ID 集合一致。前端推送后待跑生产 Smoke |
| 2026-09-18 | 上线验收 | 将本地实现推送 `main`（`02722d0`），Vercel Git 状态为 Deployment has completed；经本机代理对稳定域名执行匿名 Smoke | `/login` 200、受保护页面重定向、7 个受保护 API 返回 JSON 401、未知页面边界正常；Smoke 通过。新版认证态训练仍待实际账号复测 |
| 2026-09-20 | 正确性修复（用户反馈已测试，详情未核验） | 改用当地墙上时钟计算 03:00 训练日并修复算法/八股周次；新增任务原子落库 RPC 迁移 `202609200001_daily_task_idempotency.sql`、类型定义和 Supabase 适配器，任务写入后以数据库实际行为准；补洛杉矶/伦敦 DST、模拟并发和 RPC 缺失回归；同步 README/AGENTS/AI 提示词，澄清 AI 高估及客户端可信范围 | 用户本轮反馈“已经完成测试”；文件连接无法核对具体 lint/typecheck/test/build、SQL 迁移、并发或部署结果，故不将这些状态记为独立验证通过。 |
| 2026-09-20 | 第二轮增量写入（待验收） | 新增 `training-mutation.ts` 统一并按 Attempt ID 幂等合并；算法 Start/Cancel/Complete/AI 与知识 Learn/Recall 路由返回 `{ mutation }`，不再在上述写入后执行全量快照查询；客户端 hook 加入版本防旧请求覆盖，训练组件改接增量结果；保留导入、设置及首次载入的原有契约；新增 `training-mutation.test.ts` 和路由回归 | 通过文件连接完成源码、测试、文档写入；尚未运行 Node 质量门或真实账号测试。必须先完成回归，不能以实现等同于性能实测或上线。 |
| 2026-09-20 | 优化路线第 3 项：八股 Recall 历史对比（源码完成、未验收） | 新增 `lib/knowledge/recall-history.ts` 按题目/Attempt ID 取两次真实 Recall，并按历史关键点文本对比持续遗漏、新遗漏和补齐，生成单条聚焦复习提示；新增 `recall-history-panel.tsx` 展示记录中的 AI 复核；训练页刷新后从本地或云端 Attempt 恢复，不依赖组件瞬态值。缺 AI 时统一按确定性口径对比；提交后补做 AI 仅解释，不改分。补浏览器存储/云端重复 Snapshot/纯逻辑/SSR 组件用例与 README、AGENTS、PLAN 文档；题库文件由其他 Agent 单独负责。 | 文件读写与静态人工检查完成。mac-host 仅文件接口，不能运行 lint/typecheck/test/build 或登录真实账号；未修改 DB Schema、未部署，必须待质量门与真实刷新/重登验收后才标记为完成。 |
| 2026-09-20 | 新功能：手动暂停计划（源码完成、未验收） | 新增 `lib/profile/pause.ts` 定义暂停训练日区间，Settings 按钮、Dashboard 提示与恢复入口；Profile 新字段和 `202609200002_plan_pause.sql` 事务 RPC；SQLite/浏览器 Demo/云端三路径保存，Planner、首周期、连续训练和 Dashboard 欠账跳过暂停日。恢复时仅顺延暂停前安排且原定暂停期间到期的复习，不改 Attempt/Mastery，暂停期间主动练习产生的复习不重复顺延。新增 `plan-pause.test.ts`、本地 SQLite / profile 兼容 / API Auth 测试用例。 | 仅文件写入，**未执行 npm lint/typecheck/test/build，未应用迁移或真实账号测试**；上线顺序：备份→测试库迁移与 RLS/双标签页/DST→全量质量门→生产迁移→部署→真实账号回归。 |
| 2026-09-20 | 八股答案清洗第一批（源码完成、未验收） | 原始 full/core JSON/CSV 保留不改；新增 `lib/knowledge/content-cleaning.mjs`、类型声明、`data/knowledge/answer_review_patches.json`，共享于 catalog 与 Seed；保守裁切明确的作者广告后记并修正摘要 `：。` 等机械标点。首批四题审校：抽象类/接口、HashSet、Stream 包名、JVM 字节码解释/JIT，连同部分 key_points 与别名一并修复；新增 `scripts/audit-knowledge.mjs` 全题候选清单、`knowledge:audit[:report]` 命令、`tests/knowledge-content-cleaning.test.ts` 和 `ANSWER_REVIEW_LOG.md`；README/AGENTS 同步。 | 仅经连接写入及源码抽查；**未运行 audit/seed:check/lint/typecheck/test/build，未测试数据库 Seed 或部署**。需先审查 diff、质量门、备份后测试库 upsert，核查原始 904/120、旧 Attempt/Mastery 不变和 Recall 回归。不能把 4 题人工审校宣传为完成全部 904 题。 |
| 2026-09-20 | 八股答案持续逐题审查（上一批文件写入，未验收） | 在此前批次基础上逐题核对并追加 41 道 Java 并发 JMM/volatile/synchronized/锁升级/ReentrantLock/AQS/CAS 的 UUID 修订，答案与评分关键点同步；重点消除物理时间 happens-before、固定 DRAM 刷新、全部重排禁止、固定四态升级、CAS 失败直接加不一致锁等误导。 | 文件连接写入成功；未运行质量门或 Seed，904 道全量审查未完成。 |
| 2026-09-20 | 八股答案连续审校（本轮追加 90 道，未验收） | 读并发源书序 101–157 与集合源书序 1–37，扣除原有补丁，新增 56+34 个 UUID 的简答、面试答、详答和关键点修订；修 Semaphore 许可错误、线程池状态/关闭及并发源码、作者项目伪经历/宣传、集合 fail-fast 与弱一致、HashMap 契约和负哈希余数；更新审校日志与重点回归测试。原始题库和历史记录不改。 | 文件级写入；没有 Node/数据库/生产执行权限，未运行 knowledge:audit/seed:check/lint/typecheck/test/build、未进行真实 Recall 或 Seed；仍不能声称 904 道完成。 |
| 2026-09-20 | 八股答案继续逐题审校（核心 JVM 7 道，未验收） | 复核 JVM 内存区域、对象创建与访问、老年代晋升、可达性分析、CMS 和双亲委派；同步重写短答、面试答、详答及 Recall 关键点，补充 JVM/JDK 版本边界，保留原始题库。 | 便携 Node 24.19 解析补丁 JSON 并运行 `audit-knowledge.mjs` 通过；人工审校累计 287、剩余 617。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续核心 Java 基础/并发/集合。 |
| 2026-09-20 | 八股答案继续逐题审校（Java 并发剩余 33 道，未验收） | 完成并发题剩余协程、线程通信/生命周期、ThreadLocal、Exchanger、CompletableFuture、线程安全、AQS 公平锁、原子类及死锁题的四级答案与 Recall 关键点；纠正 JMM 物理刷新、sleep/interrupt/stop、线程状态、daemon、CAS/Unsafe 版本边界、公平锁 FIFO 和死锁规避等表述。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；Java 并发 157/157 进入审校投影，累计 331、剩余 573，核心 120 已全部进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步审查 JVM、Java 基础和 Java 集合剩余题。 |
| 2026-09-20 | 八股答案继续逐题审校（JVM 剩余 54 道，未验收） | 完成 JVM 其余栈/本地方法栈、对象分配、引用/分代 GC、收集器、性能诊断、OOM、类生命周期/委托、SPI、Tomcat 和热部署题；修正固定堆布局、栈上分配、引用计数、旧版 GC 工具和收集器版本边界，移除诊断/作者式绝对结论。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；JVM 124/124、Java 并发 157/157 进入审校投影，累计 385、剩余 519，核心 120 已全部进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步审查 Java 基础和 Java 集合。 |
| 2026-09-20 | 八股答案继续逐题审校（Java 集合剩余 20 道，未验收） | 完成哈希函数/冲突、开放地址与拉链、HashMap 默认容量/负载因子/扩容、JDK7/8 搬迁、手写设计、TreeMap、HashSet 题；补齐空 `key_points`，修正负载因子“全局最优”、HashMap 顺序/并发安全、扩容迁移和重复 key 替换等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；Java 集合 64/64、JVM 124/124、Java 并发 157/157 进入审校投影，累计 405、剩余 499，核心 120 已全部进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步审查 Java 基础。 |
| 2026-09-20 | 八股答案继续逐题审校（Java 基础首批 20 道，未验收） | 完成 `this`、抽象类/接口构造器、多继承与抽象设计、成员/静态成员、`final`、`==/equals`、`hashCode` 契约、父子类初始化顺序、String 不可变性和常用方法；四级答案与 Recall 关键点同步更新，保留原始题库。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 441、剩余 463，Java 并发/JVM/Java 集合及核心 120 仍已进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Java 基础。 |
| 2026-09-20 | 八股答案继续逐题审校（Java 基础第二批 17 道，未验收） | 完成 String 三类实现与使用场景、字符串池、Integer 缓存、对象比较/拷贝/文本化、线程调度、反射、GC、异常处理和 finally/suppressed exception；纠正固定对象数量、包装类引用比较、GC 立即回收和异常覆盖等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 458、剩余 446，核心 120 与 Java 并发/JVM/Java 集合全分类仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Java 基础。 |
| 2026-09-20 | 八股答案继续逐题审校（Java 基础 I/O/序列化 14 道，未验收） | 完成流方向、字节/字符流、节点/处理流、装饰器/适配器、ByteBuffer 边界、文本/视频、Serializable、static/transient、对象图与格式选型；修正“字符等于字节”、固定缓冲区行为、static 随对象序列化和不可信 readObject 等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 470、剩余 434，核心 120 与 Java 并发/JVM/Java 集合全分类仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Java 基础泛型、注解、反射和 Java 8 题。 |
| 2026-09-20 | 八股答案继续逐题审校（Java 基础网络/泛型/注解/Java 8 13 道，未验收） | 完成 Socket、RPC、泛型与通配符、类型擦除、注解元数据、反射原理与场景、Java 8、Lambda、函数式接口和 Optional；修正 TCP 消息边界、RPC 重试幂等、类型擦除“所有信息消失”、Retention、Lambda 捕获和 `orElse` 求值等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 483、剩余 421，Java 基础 126/126、核心 120 与 Java 并发/JVM/Java 集合全分类进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步进入 MySQL。 |
| 2026-09-20 | 八股答案继续逐题审校（MySQL 基础前 20 道，未验收） | 完成 MySQL 概念/DDL、ORDER BY、性能诊断、JOIN/三种连接、范式、建表、CHAR/VARCHAR、BLOB/TEXT、时间类型、IN/EXISTS、NULL、金额、浮点、utf8mb4、DROP/DELETE/TRUNCATE；修正版本/引擎绝对说法、外连接 WHERE 陷阱、NULL 三值逻辑、金额浮点、emoji 字符集和破坏性操作边界。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 503、剩余 401，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL。 |
| 2026-09-20 | 八股答案继续逐题审校（MySQL 基础 21–30，未验收） | 完成 UNION/UNION ALL、COUNT、SQL 逻辑执行顺序、LIMIT、ORDER BY 及常用 MySQL 客户端、数据库/表/行、索引/约束命令；修正“物理执行顺序固定”、`COUNT(1)` 必然更快、`NOT IN`/NULL、DDL 无锁和命令无版本/权限边界等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 513、剩余 391，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL。 |
| 2026-09-20 | 八股答案继续逐题审校（MySQL 基础/架构 31–44，未验收） | 完成用户权限、事务、bin 目录工具、分页、函数/隐式转换/语法树、基础架构、binlog、查询/更新流程、段区页行、存储引擎和引擎切换；修正 `FLUSH PRIVILEGES`、两阶段提交、逻辑/物理执行、版本/配置、外键与 DDL 锁等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 527、剩余 377，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL。 |
| 2026-09-20 | 八股答案继续逐题审校（MySQL InnoDB/日志 45–56，未验收） | 完成引擎选型、InnoDB/MyISAM、内存结构、数据页、Buffer Pool、默认容量、LRU、日志分类、binlog/参数、redo/undo/binlog 分工与 redo 工作机制；修正固定默认值、固定页结构、LRU 比例、日志层次和刷盘时序等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 539、剩余 365，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL 日志与事务题。 |
| 2026-09-20 | 八股答案继续逐题审校（MySQL redo/WAL 57–68，未验收） | 完成 redo 容量/WAL、binlog 与 redo、2PC/XID、redo 写入/刷盘、`innodb_flush_log_at_trx_commit`、未提交日志、顺序写和 `buf_next_to_write`；修正固定日志大小、2PC 绝对强一致、未提交 redo 不刷盘、write/fsync 混淆和内部指针硬编码。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 551、剩余 353，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL 日志/慢 SQL。 |
| 2026-09-20 | 八股答案继续逐题审校（MySQL redo/慢 SQL 69–80，未验收） | 完成 MTR、redo block/LSN/checkpoint、redo 调优、慢 SQL、执行流程、优化、慢日志、SQL 优化和覆盖索引；修正“512 字节等于原子写”“LSN 是物理地址”“慢 SQL 只看毫秒”“覆盖索引只看索引存在”等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 563、剩余 341，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL 索引与事务。 |
| 2026-09-21 | 八股答案继续逐题审校（MySQL 索引/分页/EXPLAIN 81–96，未验收） | 完成联合索引、keyset/offset 分页、JOIN 与驱动表、多表连接、排序/filesort、排序记录、Sort_merge_passes、条件下推、SELECT *、优化方法、EXPLAIN 字段和 type；修正“表小驱动大”“filesort 必然落盘”“type 越高越好”“有索引即覆盖”等绝对说法。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 579、剩余 325，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL 索引与事务。 |
| 2026-09-21 | 八股答案继续逐题审校（MySQL 索引设计 97–112，未验收） | 完成索引收益/分类、主键/唯一/普通/全文索引、索引边界、LIKE、低基数/区分度、适合字段、索引数量和优化思路；修正“低基数绝对不能建”“索引越多越好”“只看 type/区分度”“唯一 key 与 index 完全不同”等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 594、剩余 310，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL B+Tree 与事务。 |
| 2026-09-21 | 八股答案继续逐题审校（MySQL B+Tree 113–124，未验收） | 完成 B+Tree 结构/叶子链、MongoDB 实现边界、容量/高度/叶子容量、二叉树/平衡树/B-tree/跳表对比、复杂度和范围查询；修正固定“三层”、固定每页行数、MongoDB 与 MySQL 树结构绝对对立及只看 O(logN) 等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 606、剩余 298，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL 事务与锁。 |
| 2026-09-21 | 八股答案继续逐题审校（MySQL 索引细节 125–139，未验收） | 完成快排/Hash、回表与代价/触发、MRR、联合索引结构与叶子、覆盖索引、具体建索引、最左前缀与范围后列；修正“filesort 就是快排”、Hash 普适、回表越多越好、二级叶子存整行、固定索引层数和范围后列绝对失效等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 620、剩余 284，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL 锁与事务。 |
| 2026-09-21 | 八股答案继续逐题审校（MySQL 联合索引与 EXPLAIN 140–149，未验收） | 完成最左前缀、联合索引场景、IN/范围条件、LIKE、索引下推、EXPLAIN 和多列条件；修正“跳过最左列必然完全不走索引”“范围后列绝对失效”“LIKE 前缀一定使用索引”“ICP 等同于查找边界”等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 630、剩余 274，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL 锁与事务。 |
| 2026-09-21 | 八股答案继续逐题审校（MySQL 锁基础 150–153，未验收） | 完成锁分类、全局锁、表锁/MDL 和行锁；修正把行锁说成物理行、把全局锁等同只读配置、把 MDL 与数据锁混淆以及忽略索引/隔离级别影响等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 634、剩余 270，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL 事务锁细节。 |
| 2026-09-21 | 八股答案继续逐题审校（MySQL 事务锁细节 154–163，未验收） | 完成 `SELECT ... FOR UPDATE`、记录/间隙/临键锁、意向锁、乐观/悲观锁、库存超卖和死锁；修正把锁定读当普通读、把间隙锁/临键锁固定化、忽略 autocommit/隔离级别/索引、应用锁替代数据库原子更新和只重试最后一条 SQL 等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 644、剩余 260，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL ACID 与隔离。 |
| 2026-09-21 | 八股答案继续逐题审校（MySQL ACID 164–173，未验收） | 完成事务四大特性、原子性/一致性/隔离性/持久性、ACID 机制和保证方式；修正把一致性归因于数据库自动保证、把持久性说成任何灾难零丢失、把快照读/当前读混淆以及把隔离性说成物理时间串行等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 654、剩余 250，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL 隔离级别与 MVCC。 |
| 2026-09-21 | 八股答案继续逐题审校（MySQL 隔离级别与 MVCC 174–185，未验收） | 完成 autocommit、四级隔离、读未提交/已提交/可重复读/串行化、未提交值可见性、隔离级别设置、隔离实现、幻读、避免幻读和当前读；修正把级别行为固定化、忽略语句类型/事务边界、把快照读当当前读、把 RR 简化为绝对无幻读以及把当前读说成读未提交等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 666、剩余 238，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL MVCC 与事务补充题。 |
| 2026-09-21 | 八股答案继续逐题审校（MySQL MVCC 186–193，未验收） | 完成 UPDATE/DELETE 当前读、快照读、MVCC、版本链、Read View、版本可见性、RR/RC 快照差异和并发读写分析；修正把写操作当快照读、把 Read View 当物理副本、混淆事务 ID 可见性、把 RC 说成没有 MVCC以及忽略时间线/当前读等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 674、剩余 230，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL 复制与分库分表。 |
| 2026-09-21 | 八股答案继续逐题审校（MySQL 复制与分库分表 194–203，未验收） | 完成读写分离、实现方式、主从复制、复制延迟、半同步复制、分库/分表、分片策略、不停机扩容和中间件；修正“副本收到日志即已应用”“半同步保证零丢失”“SELECT 全发副本”、固定分片策略和中间件自动解决一致性等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 684、剩余 220，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 MySQL 分片问题与大表运维。 |
| 2026-09-21 | 八股答案继续逐题审校（MySQL 分片、运维与 SQL 204–213，未验收） | 完成分库分表问题、分布式 ID、Snowflake、大批量删除、大表加字段、CPU 排障、基础查询、分组统计和分组 Top-N；修正把分片当成无代价优化、Snowflake 天然绝对有序、大事务删除/在线 DDL 无风险、CPU 只靠重启以及全表 LIMIT 代替分组 Top-N 等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 694、剩余 210，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步完成 MySQL 末尾题目。 |
| 2026-09-21 | 八股答案继续逐题审校（MySQL 大表与深分页 214–217，未验收） | 完成大表关联优化、批量导入与索引顺序、深分页；修正固定“小表驱动大表”、先建/后建索引绝对化、忽略大事务与在线 DDL 风险、把深分页理解为直接跳转等误导。MySQL 215/215 已进入审校投影。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；全量累计 698、剩余 206，Java 四分类与核心 120 仍进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步进入 Redis。 |
| 2026-09-21 | 八股答案继续逐题审校（Redis 基础与核心数据结构 1–12，未验收） | 完成 Redis 定位、MySQL 对比、项目场景、部署/高可用、用途、核心类型、string/list/hash/set/zset；修正“Redis 只是缓存”“一定单线程”“有从库就强一致”“内部结构固定”和“大集合全量读取无代价”等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 710、剩余 194，MySQL 215/215、Java 四分类与核心 120 进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Redis 特殊类型与性能。 |
| 2026-09-21 | 八股答案继续逐题审校（Redis 特殊类型、I/O 与线程 13–24，未验收） | 完成 Bitmap、HyperLogLog、GEO、hash/string 取舍、Redis 性能、I/O 多路复用、select/poll/epoll/kqueue/IOCP、事件循环、单线程和 Redis 6 网络 I/O 多线程；修正固定内存/误差、把 readiness 当 completion、把单线程说成全进程单线程以及把 Redis 6 说成命令全面并行等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 722、剩余 182，MySQL 215/215、Java 四分类与核心 120 进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Redis 并发、持久化与集群。 |
| 2026-09-21 | 八股答案继续逐题审校（Redis 命令与性能 25–29，未验收） | 完成常用命令、SET、SADD 复杂度、INCR 和 QPS；修正无界 KEYS/大集合读取、SETNX+EXPIRE 竞态、复杂度固定延迟、INCR 复合原子性和固定 QPS 等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 727、剩余 177，MySQL 215/215、Java 四分类与核心 120 进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Redis 持久化。 |
| 2026-09-21 | 八股答案继续逐题审校（Redis 持久化 30–36，未验收） | 完成 RDB/AOF/混合持久化、RDB 快照与触发、AOF 与刷盘、AOF rewrite 机制和具体流程；修正固定 QPS、把快照/命令日志混淆、把 everysec 说成绝对一秒、忽略 fork/COW、增量缓冲和原子切换等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 734、剩余 170，MySQL 215/215、Java 四分类与核心 120 进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Redis 持久化恢复与复制。 |
| 2026-09-21 | 八股答案继续逐题审校（Redis 持久化恢复与配置 37–44，未验收） | 完成 AOF 内容、rewrite 期间双写、RDB/AOF 优缺点与选型、数据恢复、混合持久化、模式设置和开发配置；修正把 AOF 当内存镜像、双写当命令执行两次、everysec/混合模式绝对化、忽略恢复校验和开发生产差异等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 742、剩余 162，MySQL 215/215、Java 四分类与核心 120 进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Redis 复制与高可用。 |
| 2026-09-21 | 八股答案继续逐题审校（Redis 复制与 Sentinel 45–57，未验收） | 完成主从复制、作用、不一致与修复、拓扑、全量/增量同步、复制问题、脑裂、Sentinel、故障转移 leader 和新主选择；修正“有副本即强一致”“复制零丢失”“收到日志即追平”“Sentinel 自动消除脑裂”以及忽略 quorum/epoch/客户端切换等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 755、剩余 149，MySQL 215/215、Java 四分类与核心 120 进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Redis Cluster 与缓存问题。 |
| 2026-09-21 | 八股答案继续逐题审校（Redis Cluster 与缓存保护 58–71，未验收） | 完成 Cluster、槽位分区、动态伸缩、MOVED/ASK、缓存击穿/穿透/雪崩、布隆过滤器及误判/删除/哈希表对比；修正把集群节点数绝对化、MOVED/ASK 混淆、三类缓存故障混淆、Bloom 无误判/可直接删除等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 769、剩余 135，MySQL 215/215、Java 四分类与核心 120 进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Redis 缓存一致性与热点。 |
| 2026-09-21 | 八股答案继续逐题审校（Redis 缓存一致性与热点 73–82，未验收） | 完成删除或更新缓存、先写库后删缓存、高一致性、本地/分布式二级缓存、缓存组件设计、本地缓存对比、热 Key 监控/治理和大 Key；修正把删缓存当强一致、Pub/Sub 当可靠失效、热 Key 与大 Key 混淆、长期 MONITOR 和直接 DEL 大对象等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 779、剩余 125，MySQL 215/215、Java 四分类与核心 120 进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Redis 其他工程题。 |
| 2026-09-21 | 八股答案继续逐题审校（Redis 缓存/队列工程 83–91，未验收） | 完成缓存预热、无底洞、内存不足、过期/淘汰、LRU/LFU、阻塞、异步消息队列和延时队列；修正无底洞只加节点、内存只看 used_memory、过期等于定时回调、Pub/Sub 可靠队列和 zset 自动可靠延迟消息等误导。源书序 92 无待审投影。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 788、剩余 116，MySQL 215/215、Java 四分类与核心 120 进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Redis 事务与锁。 |
| 2026-09-21 | 八股答案继续逐题审校（Redis 事务、Lua、Pipeline 与锁 93–102，未验收） | 完成事务原理与边界、回滚/ACID、Lua、Pipeline、底层流程、使用场景和分布式锁；修正把不交错执行当完整回滚、把 Pipeline 当事务/并发执行、忽略脚本阻塞/批量背压以及用 SETNX/DEL 直接实现安全锁等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 798、剩余 106，MySQL 215/215、Java 四分类与核心 120 进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Redis 分布式锁与底层结构。 |
| 2026-09-21 | 八股答案继续逐题审校（Redis 分布式锁 103–110，未验收） | 完成 SETNX 竞争、SETNX 风险与改进、Redisson、看门狗原子性、Redlock、红锁边界和项目落地；修正“SETNX 即完整锁”“看门狗/Redlock 百分百安全”“脚本原子等于生命周期原子”以及忽略 fencing/旧持有者等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 806、剩余 98，MySQL 215/215、Java 四分类与核心 120 进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Redis 底层数据结构。 |
| 2026-09-21 | 八股答案继续逐题审校（Redis 底层结构 111–124，未验收） | 完成 SDS、dict、链表/intset、zset、listpack/ziplist 连锁更新、跳表/span 和范围查询；修正把历史 ziplist/链表结构当作 Redis 7 固定实现、把 zset 简化成跳表、把 span 当字节长度和把期望复杂度绝对化等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；累计 821、剩余 83，MySQL 215/215、Java 四分类与核心 120 进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Redis 紧凑结构与工程题。 |
| 2026-09-21 | 八股答案继续逐题审校（Redis 底层/秒杀/限流 125–134，未验收） | 完成 span/range、ziplist/listpack、quicklist、LZF、前缀扫描、秒杀、削峰和限流；修正 ziplist 65535 计数边界、无界 KEYS、Redis 扣减等于交易完成、无限队列削峰和限流算法绝对化等误导。Redis 源书 134/134 已进入审校投影。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；全量累计 830、剩余 74，MySQL 215/215、Redis 134/134、Java 四分类与核心 120 进入审校投影。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步进入 Spring。 |
| 2026-09-21 | 八股答案继续逐题审校（Spring 基础 1–9，未验收） | 完成 Spring 定位/特性、AOP/IoC、源码刷新主线、模块、常用注解、设计模式、容器单例和 Spring/Web 容器边界；修正把 Spring Boot/Cloud 等同 Framework、把 IoC/AOP 混为一谈、把 AOP 说成无边界拦截、把 Spring 单例说成 JVM 全局单例以及混淆 Spring 容器与 Web 容器等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；全量累计 839、剩余 65，MySQL 215/215、Redis 134/134、Java 四分类与核心 120 进入审校投影；审计候选降至 5 个。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Spring IoC 与 Bean 生命周期。 |
| 2026-09-21 | 八股答案继续逐题审校（Spring IoC/Bean 11–20、22–26，未验收） | 完成 IoC/DI、使用收益、实现机制、手写容器边界、BeanFactory/ApplicationContext、启动流程、实例化、Bean 定义、@Component/@Bean、Aware、初始化/销毁、构造器注入、@Autowired/@Resource 和处理器；修正把 DI 等同 IoC、把容器简化成直接 new、把 ApplicationContext 与 BeanFactory 能力倒置、把 prototype 自动销毁、字段注入无代价以及注入规则绝对化等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；全量累计 854、剩余 50，审计候选降至 4 个。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Spring AOP、生命周期和 Web。 |
| 2026-09-21 | 八股答案继续逐题审校（Spring 自动装配/循环依赖/AOP 27–39，未验收） | 完成自动装配、XML 装配类型、作用域、单例线程安全、循环依赖与三级缓存、AOP 核心概念和代理/织入方式；修正把自动装配说成固定按字段名、把作用域当线程安全、把三级缓存当通用解法、把 Spring 代理叫成 AspectJ 编译织入等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；全量累计 866、剩余 38，审计候选降至 3 个。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Spring AOP 通知、事务和 MVC。 |
| 2026-09-21 | 八股答案继续逐题审校（Spring AOP/事务 40–58，未验收） | 完成 AspectJ、通知类型与时机、AOP/OOP、Spring AOP 与 AspectJ/反射、JDK/类代理、事务实现/失效、隔离/传播、跨线程和 protected/private 边界；修正通知时机、代理与织入概念、异常回滚、线程绑定、数据库隔离和自调用等误导，并压缩长答。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；全量累计 884、剩余 20，审计候选降至 1 个。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步继续 Spring MVC、Boot 及剩余题。 |
| 2026-09-21 | 八股答案继续逐题审校（Spring MVC/Boot 59–64、66–72，未验收） | 完成 MVC 核心组件/流程、HandlerAdapter、REST、Boot 定位/注解/Starter/自动配置/启动/主类/扫描路径、Boot 与 MVC/Spring 区别；修正把 HandlerMapping 和 Adapter 混为一谈、把 Boot 当 MVC、把启动类说成扫描 main、把组件扫描等同自动配置以及把 REST 简化成返回 JSON 等误导。 | 便携 Node 24.19 下补丁 JSON 解析与 `audit-knowledge.mjs` 通过；全量累计 897、剩余 7，审计候选已降为 0。尚未运行 `seed:check`、lint/typecheck/test/build、数据库 Seed 或 Recall。下一步完成 Spring Cloud/微服务/任务/缓存及剩余 7 题。 |
| 2026-09-21 | 全量八股审校报告与质量门修复（未验收） | `knowledge:audit:report` 与 `seed:check` 通过；生成 `output/knowledge-audit.json`，确认 904/904 人工审校、0 未审、0 候选，Seed 预演确认 100/165/904/120。质量门首次运行发现 `tests/knowledge-content-cleaning.test.ts:208` 的回归用例回调缺少 `=>`，已补齐最小语法。 | 便携 Node 24.19；audit report/seed check 通过；lint/typecheck/test/build 在该语法错误处失败（测试实际已有 356 项通过、1 个文件解析失败），修复后待重跑四项。数据库 Seed、真实 Recall 和部署仍未运行。 |
| 2026-09-21 | 全量审校质量门类型/回归修复（未验收） | 收敛 `lib/knowledge/catalog.ts` 对全量 JSON 联合类型的显式源题目类型；更新 `knowledge-content-cleaning` 回归断言以匹配当前已审答案，并改为验证源题元数据不被投影改写。 | 修复后待重跑便携 Node 24.19 下 lint/typecheck/test/build；此前 audit report/seed check 已通过，数据库 Seed、真实 Recall 和部署仍未运行。 |
| 2026-09-21 | 全量八股审校本地质量门通过（数据库/生产未验收） | 完成全量 904 道 UUID 审校投影；保留原始 JSON/CSV。修复题库接入的 JSON 联合类型、回归用例箭头语法和与新审校文案不一致的测试假设。 | 便携 Node 24.19 下 `knowledge:audit:report`、`seed:check`、lint、typecheck、test、build 全部通过；904/904 人工审校、0 未审、0 候选；38 个测试文件、369 项测试、239 个页面。仅文件与本地质量门已验收，数据库 Seed、真实 Recall/刷新和部署未运行。 |
| 2026-09-21 | 暂停计划欠账可继续完成（本地质量门通过，真实环境待验收） | 修复算法/八股 `ensureToday*Tasks` 暂停时过早返回的问题：先补出暂停前有效训练日缺失的历史新学任务，再禁止创建暂停日新任务；Dashboard 暂停时不再隐藏欠账区；进度汇总仅保留暂停开始前已逾期复习，休息期间新到期项留待恢复后顺延。完成欠账仍复用原 Attempt/Mastery/任务完成链路，不新增 SQL Migration。 | `plan-pause.test.ts` 回归覆盖暂停日冻结、历史 backfill 生成、暂停期间完成算法/八股旧账及旧逾期/新到期边界。便携 Node 24.19 下 lint、typecheck、test、build 全部通过：38 个测试文件、371 项测试、239 个页面。真实账号、Supabase RLS/迁移和部署仍待验收。 |
| 2026-09-21 | 连续下一题质量门首轮修复（待重跑） | 完成 `lib/progress/next-task.ts` 选择器、Algorithm/Knowledge 完成页入口、动态题页按 ID 重置及对应测试；首轮质量门发现 KnowledgeTraining render 直接调用 `Date.now()` 违反 React purity，改为组件时钟状态。 | 便携 Node 24.19 下 typecheck、test（39 个测试文件、378 项）和 build（239 个页面）通过；lint 因 purity 错误失败后已修复，四项需重跑。真实账号和生产验收仍未运行。 |
| 2026-09-21 | 连续下一题 React purity 二次修复（待重跑） | 将 KnowledgeTraining 的当前时间统一由组件 `clock` 状态和 60 秒定时器提供，移除 render/提交闭包中的直接 `Date.now()` 调用。 | 便携 Node 24.19 下 typecheck、test、build 已通过；lint 首轮 purity 错误已继续修复，四项需重跑。真实账号和生产验收仍未运行。 |
| 2026-09-21 | 连续下一题本地质量门通过（真实环境待验收） | 完成下一任务选择器、Algorithm/Knowledge 完成页入口、动态题页状态重置和 Knowledge 时钟 purity 修复；保留暂停欠账、到期复习和 Learn 新学优先语义。 | 便携 Node 24.19 下 lint、typecheck、test、build 全部通过：39 个测试文件、378 项测试、239 个页面。真实账号、Vercel 部署后的 Learn/Recall/Algorithm 跳转及生产验收仍未运行。 |
