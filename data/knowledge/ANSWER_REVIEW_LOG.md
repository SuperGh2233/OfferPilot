# OfferPilot 八股答案人工审校日志

更新：2026-09-20。**在此前 33 道初始修订和上一轮新增 41 道的基础上，本轮按 UUID 再新增 90 道修订（Java 并发书序 101–157 中 56 道，Java 集合书序 1–37 中 34 道；已存在补丁的题未重复计算）。这不是累计精确题数；累计以实际运行 `npm run knowledge:audit` 返回的 `manuallyReviewed` 为准。其余未进入补丁的题不得视为审查通过，904 道全量审校仍未完成。** 原始 `offerpilot_bagu_full.json` / CSV / 核心快照不可直接覆写，审校后的单题修订写入 `answer_review_patches.json`。运行时与云端 Seed 使用此修订投影；云端尚未执行 Seed。本文件区分已人工核对、明确排除的非技术尾巴及待人工复核，不以规则扫描代替逐题审核。

## 最早审阅、已写入补丁的 4 道

| Question ID | 问题 | 原文缺陷 | 本次调整 |
| --- | --- | --- | --- |
| `0ae8a158-3d24-5442-b7a7-ecad512dfb45` | 抽象类和接口有什么区别？ | 接口误类比为 has-a；关键点夹杂 Runnable 场景而缺失核心差异 | 改成继承数量、共享状态与构造、行为契约、Java 8/9 接口方法差异；短答、面试答、详答、关键点与别名同步 |
| `ca4c85ef-5c67-5cbe-bc06-98812681d67f` | HashSet 怎么判断重复？ | 把 HashMap 更新 value 写成替换 HashSet 元素；全文混入作者推广 | 更正 add 返回值、hashCode/equals 与散列冲突；强调已有 key 不被替换；更换四级答案及关键词 |
| `9aed04e7-7995-52a7-aedc-d6eeaecdcdce` | Stream 流用过吗？ | 将接口包名错写为 `java.util.Stream`；结尾混入宣传材料 | 仅对该题替换为 `java.util.stream.Stream`，并裁切经确认的推广尾巴；保留技术实例 |
| `2bf4f9b0-e426-554e-bf9b-8de0816c2885` | 解释执行与编译执行 | 把 JVM 解释的对象误写成 Java 源码；引入编辑日期与宣传后记 | 区分 javac 源码→字节码、解释器执行字节码与 JIT 编译热点字节码；同步关键点 |

## 追加直接审阅与修订的 29 道（合计 33 道）

以下每项均已按题目 UUID 更新短答、面试答、详答及关键点（仅 Stream 原题采取定向替换）。已检查范围不等于整个章节全部通过。

| 分类 | 直接修订的题目与问题 |
| --- | --- |
| Java 基础（6） | String/StringBuilder/StringBuffer：修复一句话与仅有 `synchronized` 的关键点；BIO/NIO/AIO：补完异步与非阻塞区别；反射：移除弃用的 `Class.newInstance` 和不保证生效的私有字段访问；Java 概述：纠正“必须安装 JDK”；八种数据类型：纠正 `boolean` 固定内存和局部变量默认值；float：把错误的 1/10/21 位改为 1/8/23 位，修正偏置指数和示例。 |
| Java 基础续（1） | String→Integer：清除作者 PS，厘清 `parseInt`、`valueOf`、负数累积及溢出。 |
| Java 集合（4） | ArrayList/LinkedList：补访问、插删复杂度和内存；并发 Map：纠正 synchronizedMap 性能断言；HashMap put：重排完整插入和扩容流程；HashMap 底层：纠正碰撞与 key 相等混淆和树化条件。 |
| Java 集合续（1） | HashMap 阈值：明确树化 8、退化 6、数组容量至少 64。 |
| Java 并发（3） | ThreadLocal 原理、内存滞留：纠正弱引用 key 被回收不代表强引用 value 自动置空，增加 `remove`；线程池阻塞队列：纠正 `DelayedWorkQueue` 与 `DelayQueue` 混淆，清除资料作者项目经历。 |
| JVM（2） | 垃圾回收机制：按 GC Roots 而非长期未使用判死；常见收集器：删除 ZGC 固定毫秒承诺和不适用的二分法。 |
| Spring（5） | Bean 生命周期：修正 BeanPostProcessor 前后顺序；循环依赖：补构造器、prototype、Boot 默认配置限制；Boot 自动装配：区分 `AutoConfiguration.imports` 与早期 `spring.factories`；AOP 场景、IoC：剔除第三方项目履历及无关类比，重写技术回答。 |
| MySQL（2） | 索引设计：删除“单表最多五个”硬规则；聚簇与二级索引：纠正无主键时唯一索引选择及二级索引结构。 |
| Redis（2） | Cache Aside：说明竞态与失败补偿，不宣称强一致；MULTI/EXEC：纠正 WATCH/DISCARD、出错不回滚。 |
| 非核心追补（3） | MySQL 各班前十：补同分与稳定排序，去掉有风险的用户变量方案；Redis 客户端断线：分离 FIN/RST、TCP keepalive、空闲 timeout；Spring Cache：区分代理、CacheManager、TTL 提供者和自调用。 |

**注意：**上面是最初 33 道基线，而非当前累计数量。后续补丁继续按题目 UUID 追加；精确数量由审计脚本解析全部 UUID 后计算，不根据文档中旧数字猜测。部分题目知识点短语匹配仍需要通过实际 Recall 验证；不能把文件写入视为评分验收。

核查参考（官方资料）：
- Java Language Specification，接口方法章节：https://docs.oracle.com/javase/specs/jls/se17/html/jls-9.html
- Java `HashSet.add` 返回值与重复加入行为：https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashSet.html
- Java `Stream` 官方类型：https://docs.oracle.com/javase/16/docs/api/java.base/java/util/stream/Stream.html
- JVM Specification，第 1 章 class/bytecode 与解释或编译实现：https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-1.html

## 后续批次与本轮新增：JVM、Java 基础及 Java 并发

此前已继续逐题扩充 JVM 垃圾回收、对象布局、类加载、GC 收集器与参数，Java 基础的面向对象、String、Integer、异常处理、I/O、序列化、泛型与反射，以及 Java 并发的线程与 ThreadLocal 题目；其中原本 `container_only` 且答案全空的 JVM 常用参数、三道异常处理代码题均改为 `answer_status=available`，四级答案和关键点已补齐。具体 UUID 及逐题修订以补丁为准，旧章节摘要不能视为整章审完。

**本轮追加的 41 道为 Java 并发源书序号 50–91 内的定向题（并非这一序号范围全部题都修改）：**

| 批次 | 本轮新增 | 主要实际修正 |
| --- | ---: | --- |
| JMM / volatile | 11 | 工作内存不是固定物理缓存；`i++` 复合操作；原子性/可见性/有序性；`j=i` 的整体性需要按共享状态判断；happens-before 不是物理时间先后；规范规则不只六条；as-if-serial；volatile 写读的同步语义、屏障并非固定 CPU 汇编。 |
| synchronized 基础 | 10 | volatile 与锁的边界、引用字段不保护对象后续可变状态；历史偏向锁的版本边界；实例/静态/代码块锁对象；监视器与 OS 的实现关系；解锁到后续同锁加锁的可见性；同步块内允许合法优化重排；可重入机制不是一律把线程 ID 和计数写入 Mark Word。 |
| 锁优化 / ReentrantLock / AQS | 9 | 四态锁升级不是新版 JVM 必经路径；锁消除/锁粗化；比较内置锁和显式锁的中断/超时/Condition；纠正将 `ReentrantReadWriteLock` 整类当作 `Lock` 实现；公平锁与 AQS 不能承诺严格 FIFO 或直接移交所有权。 |
| AQS / CAS | 11 | CLH 风格队列不能等同纯忙等；公平锁 `true`、非公平 `false` 的参数缺漏；无参 `tryLock()` 的公平例外；CAS 失败不自动重试；原子性并非每次总线锁；ABA 的引用身份和版本戳；修复“CAS 超时后单方面加 synchronized 并 get/set”这个不安全示例；不可变快照加 AtomicReference 原子更新多字段。 |

审校补丁仅更改指定 UUID 的短答、面试答、详答与评分关键点（另有按 ID 修复空答案状态），原始 904 个 ID、父子关系及学习历史不改。新增 `knowledge-content-cleaning` 回归断言，并让审计脚本同时统计未复核数量、空字段、空关键点、不可用答案状态以及已恢复的空题；本次连接不支持运行 Node，以上均为文件级写入，测试与报告结果尚未验证。

## 2026-09-20 本轮连续直接审校：追加 90 道（仅文件级修订，未运行测试）

- Java 并发源书序 101–157：逐题阅读源题与答案，针对尚无补丁的 56 道补齐短答、面试答、详答及原子化评分关键点；此前已修订的线程池阻塞队列题未重复修改。重点修正 Semaphore 未获取许可却 release 导致许可超额、CountDownLatch 计数与提交任务数混淆、CyclicBarrier 破损语义、Exchanger 交换对象写错、AQS/锁/乐观更新、ConcurrentHashMap JDK7/8 的空桶 CAS/非空桶锁与 MOVED 分支、线程池关闭不等待及状态迁移非单链、ScheduledThreadPoolExecutor 定时任务不重叠、作者编造的个人项目经历、无效的手写线程池/连接池源码和 Fork/Join 广告尾章。
- Java 集合源书序 1–37：已阅读该序号范围并新增 34 道定向补丁；已修订的 ArrayList/LinkedList 总览、HashMap 底层/put/树化阈值题未重复计入。修正 Collection 空评分点、ArrayList 随机访问与 LinkedList get(int)、内存/扩容/序列化、fail-fast 尽力检测与快照迭代和弱一致迭代的差异、同步列表迭代需外部同锁、红黑树规则、HashMap equals/hashCode 契约、负 hash 位掩码不等于 Java `%`、初始容量 17 惰性分配与负容量异常。
- 审校边界：这 90 道指本轮实际新增 UUID 补丁，不等于 904 道均逐条审核。其余分类和 Java 集合后半部分仍须继续审核；未运行 `knowledge:audit` / `seed:check` / lint / typecheck / test / build，未向 Supabase Seed 或部署。

## 已抽查到作者推广尾巴的资料（技术内容仍须逐题确认）

- JVM：`2bf4f9b0-e426-554e-bf9b-8de0816c2885`
- Java 基础：`9aed04e7-7995-52a7-aedc-d6eeaecdcdce`
- Java 并发：`09110c20-5d69-50dc-9295-71abcd7f9839`
- Java 集合：`ca4c85ef-5c67-5cbe-bc06-98812681d67f`
- MySQL：`bb99b654-3aee-527a-90ec-ab6a5d5dbbc7`
- Redis：`38a7dc86-fe52-5bd3-bde2-d95971e50a10`
- Spring：`aad69d37-bd32-5f05-9905-cb70c4bda4d8`

公共清洗函数只在全文出现明确的“说一点心里话”“整整……面渣逆袭……篇第二版终于整理完了”等作者尾章标记且后文同时有推广信号时，裁切尾部段落。它不删除正文中的技术术语、链接或代码片段，也不修改未被人工审校的 key_points。

## 待人工逐题复核队列（未批准自动改写）

1. 所有尚未出现在补丁中的题仍需逐题核对技术事实、答案切题程度、短答/详答/关键点相互一致和版本适用性；精确剩余数量从审计脚本的 `stillUnreviewed` 获取，不沿用原来的 871；不得因未被规则命中就判定正确。
2. 优先继续核心 120 题中尚未精修的题目及其追问，关注线程池参数、MySQL 事务隔离、Redis 持久化和 Spring 自调用等具体事实。
3. 资料作者的第一人称经历、宣传链接、编辑日期及乱码仍可能在尚未修订的题目里出现。
4. 短语匹配的 `key_points` 与真实 Recall 得分需验证，避免修正答案后仍因表达不同误判。

运行 `npm run knowledge:audit:report` 生成 904 道题的规则扫描候选 `output/knowledge-audit.json`，逐题核对并扩充补丁；脚本不会把扫描结果当成自动修复意见。上线前核对 seed 影响范围、旧历史不变、Recall 评分回归与完整质量门。当前连接未执行 Node 测试、数据库 Seed 或部署。

## 2026-09-20 继续全量审校：核心收口、Java 并发与 JVM

- 已按 UUID 完成核心 120 道的审校投影：核心剩余题先复核 JVM、Java 基础、Java 并发和 Java 集合，答案有事实缺陷时同步重写 `short_answer`、`interview_answer`、`full_answer` 与 `key_points`；没有把只通过规则扫描的题误算为人工核验。
- 已完成 Java 并发全分类 157 道与 JVM 全分类 124 道的审校投影。并发部分重点修正协程与虚拟线程边界、JMM 主内存/工作内存的抽象、sleep/interrupt/stop、线程状态、daemon、ThreadLocal、AQS 公平性、CAS/Unsafe 版本差异和死锁条件；JVM 部分重点修正固定堆布局、引用与栈上分配、分代/收集器版本、旧诊断命令、类卸载、SPI、Tomcat 委托和热部署资源泄漏。
- 当前 `knowledge:audit` 实测：904 道、核心 120 道；`manuallyReviewed=385`，`stillUnreviewed=519`，原始推广尾巴 7 道、当前投影自动裁切 1 道；这不是全量完成声明。尚未运行完整质量门、Seed、数据库迁移、真实 Recall 或部署。

## 2026-09-20 继续全量审校：Java 集合与 Java 基础首批

- Java 集合源书序 38–63 的 20 道题已逐题补齐 UUID 审校投影：哈希函数与碰撞、开放地址/拉链、HashMap 容量与负载因子、JDK 7/8 扩容、TreeMap、HashSet。修正“0.75 是全局最优”“HashMap 保证顺序/并发安全”“重复 key 替换 Set 元素”等绝对或混淆表述，并补齐一处空 `key_points`。
- Java 基础源书序 36、38–63 的首批 20 道题已逐题修订：`this`、抽象类/接口构造器、多继承、抽象设计、成员与静态成员、`final`、`==/equals`、`hashCode` 契约、父子类初始化顺序及 String 不可变性/常用方法。每题同步写入 `short_answer`、`interview_answer`、`full_answer` 和 `key_points`，未修改原始 full/core JSON/CSV。
- 便携 Node 24.19 实测补丁 JSON 解析和 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=441`、`stillUnreviewed=463`，原始推广尾巴 7 道、当前投影自动裁切 1 道。Java 并发 157/157、JVM 124/124、Java 集合 64/64 及核心 120 已进入审校投影；仍不能视为 904 道全量完成。
- 尚未运行 `knowledge:audit:report`、`seed:check`、lint/typecheck/test/build、数据库 Seed、真实 Recall 或部署；继续逐题审查 Java 基础剩余题及 MySQL、Redis、Spring，最终再执行质量门和测试库验收。

## 2026-09-20 继续全量审校：Java 基础第二批

- 新增 17 道 Java 基础 UUID 补丁：String 不可变性、StringBuilder/StringBuffer、拼接场景、字符串池与 `new String`、Integer 缓存、对象比较/拷贝/转字符串、线程调度、反射、GC、异常处理与 finally/suppressed exception。每题同步修订四级答案和 Recall `key_points`，保留原始 JSON/CSV。
- 重点消除固定“创建两个对象”、包装类 `==` 数值比较、`sleep/yield` 顺序保证、GC 立即回收、finally 必然保留主异常等误导，补充字符串池状态、模块访问、try-with-resources 和对象资源管理边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=458`、`stillUnreviewed=446`。尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-20 继续全量审校：Java 基础 I/O 与序列化

- 新增 14 道 Java 基础 UUID 补丁：输入/输出方向、字节/字符流、节点/处理流、I/O 装饰器/适配器、ByteBuffer 越界、文本/视频处理、序列化/反序列化、Serializable、static/transient、自定义序列化、对象图流程和序列化格式选型。同步修订短答、面试答、详答和 Recall 关键点。
- 重点修正“字符就是字节”“Java 缓冲区会静默越界”“static 随对象序列化”“transient 等于加密”“固定创建两个 String 对象”等表述，补充字符集、资源所有权、版本兼容和不可信反序列化边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=470`、`stillUnreviewed=434`。尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-20 继续全量审校：Java 基础网络、泛型与 Java 8 收口

- Java 基础剩余 13 道已完成 UUID 审校投影：Socket、RPC、泛型/通配符/类型擦除、注解、反射原理与应用、Java 8、Lambda、函数式接口和 Optional。每题同步更新四级答案和 Recall `key_points`，Java 基础 126/126 进入审校投影。
- 重点修正 TCP 没有消息边界、RPC 重试需幂等、T/E/K/V 与通配符的区别、类型擦除并非所有元数据消失、注解保留策略、Lambda 捕获、Optional `orElse`/`orElseGet` 等事实。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=483`、`stillUnreviewed=421`。Java 并发/JVM/Java 集合及 Java 基础均已进入审校投影；仍不能视为 904 道全量完成。
- Java 分类阶段完成，下一阶段进入 MySQL、Redis、Spring；尚未运行 `knowledge:audit:report`、`seed:check`、lint/typecheck/test/build、数据库 Seed、真实 Recall 或部署。

## 2026-09-20 继续全量审校：MySQL 基础前 20 道

- 新增 20 道 MySQL UUID 审校补丁：数据库/建表、排序、性能诊断、JOIN/内外连接/交叉连接、范式、建表设计、CHAR/VARCHAR、BLOB/TEXT、DATETIME/TIMESTAMP、IN/EXISTS、NULL、金额、浮点、emoji、DROP/DELETE/TRUNCATE。同步修订四级答案和 Recall 关键点。
- 重点修正版本/存储引擎绝对化、外连接条件放置、笛卡尔积、NULL 三值逻辑、`NOT IN` 遇 NULL、金额浮点误差、utf8mb4、破坏性 DDL 和执行计划等边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=503`、`stillUnreviewed=401`。尚未运行完整质量门、Seed、真实 Recall 或部署；MySQL 仍需继续逐题审查。

## 2026-09-20 继续全量审校：MySQL 基础 21–30

- 新增 10 道 MySQL UUID 审校补丁：UNION/UNION ALL、COUNT、逻辑执行顺序、LIMIT、ORDER BY，以及客户端、数据库、表、行、索引/约束管理命令。同步修订四级答案和 Recall 关键点。
- 重点修正逻辑执行顺序与物理计划的混淆、`COUNT(1)` 固定性能结论、分页稳定性、NULL/外连接语义、参数化 SQL、DDL 元数据锁和版本/权限边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=513`、`stillUnreviewed=391`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-20 继续全量审校：MySQL 基础与架构 31–44

- 新增 14 道 MySQL UUID 审校补丁：用户/权限、事务、bin 目录工具、3–10 条分页、函数、隐式类型转换、语法树、基础架构、binlog、查询/更新流程、段区页行、存储引擎和引擎切换。同步修订四级答案和 Recall 关键点。
- 重点修正权限主机匹配、`FLUSH PRIVILEGES`、autocommit/DDL 边界、逻辑与物理执行顺序、binlog/redo 两阶段提交、版本/配置固定值、页/区大小、引擎转换重建和大表锁风险。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=527`、`stillUnreviewed=377`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-20 继续全量审校：MySQL InnoDB 与日志 45–56

- 新增 12 道 MySQL UUID 审校补丁：引擎选择、InnoDB/MyISAM、内存结构、数据页、Buffer Pool、默认容量、LRU、日志分类、binlog 重点/参数、redo/undo/binlog 分工和 redo 机制。同步修订四级答案和 Recall 关键点。
- 重点修正固定 128MB、页/区结构、LRU 比例、binlog/redo/undo 层次、Server/引擎边界、刷盘与 checkpoint 时序等版本/配置敏感内容。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=539`、`stillUnreviewed=365`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-20 继续全量审校：MySQL redo/WAL 57–68

- 新增 12 道 MySQL UUID 审校补丁：redo 容量、WAL、binlog/redo、两阶段提交、XID、redo 写入/刷盘、`innodb_flush_log_at_trx_commit`、未提交 redo、顺序写和 `buf_next_to_write`。同步修订四级答案和 Recall 关键点。
- 重点修正固定日志大小、2PC 绝对强一致、redo 只保存已提交事务、write/fsync/稳定介质混淆及内部指针固定布局；补充 checkpoint、恢复、RPO/RTO 和版本/配置边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=551`、`stillUnreviewed=353`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：MySQL 索引、分页与 EXPLAIN 81–96

- 新增 16 道 MySQL UUID 审校补丁：联合索引、分页优化/变慢、JOIN 与子查询、多表连接、排序/filesort、排序记录、Sort_merge_passes、条件下推、SELECT *、SQL 优化、EXPLAIN 字段和 type。同步修订四级答案和 Recall 关键点。
- 重点修正“小表固定驱动大表”、JOIN 必然优于子查询、filesort 必然落盘、固定排序等级、条件下推由书写顺序决定、SELECT * 绝对禁用和 type 单字段验收等误导。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=579`、`stillUnreviewed=325`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：MySQL 索引设计 97–112

- 新增 16 道 MySQL UUID 审校补丁：索引收益/分类、主键、唯一/普通/全文索引、索引使用边界、LIKE、低基数/区分度、适合字段、索引数量和优化思路。同步修订四级答案和 Recall 关键点。
- 重点修正低基数索引绝对禁用、唯一索引/主键混淆、全文索引与 LIKE 混淆、索引越多越好、固定区分度阈值、索引“失效”绝对化以及只看 type 的优化结论。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=594`、`stillUnreviewed=310`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：MySQL B+Tree 113–124

- 新增 12 道 MySQL UUID 审校补丁：B+Tree 结构和叶子链、MongoDB 实现边界、容量/高度/叶子容量、二叉树/平衡树/B-tree/跳表对比、复杂度和范围查询。同步修订四级答案和 Recall 关键点。
- 重点修正固定三层/固定页行数、把 2,000 万行直接映射成树高、MongoDB 与 MySQL 的树结构绝对对立、忽略页 I/O 的 O(logN) 结论，以及叶子链/聚簇与二级索引混淆。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=606`、`stillUnreviewed=298`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：MySQL 索引细节 125–139

- 新增 14 道 MySQL UUID 审校补丁：快排/Hash、回表与代价/触发、MRR、联合索引结构与叶子、覆盖索引、具体建索引、最左前缀与范围列。同步修订四级答案和 Recall 关键点。
- 重点修正把 filesort 等同快排、Hash 适用于所有查询、回表越多越好、二级索引叶子存整行、固定树高/页容量、范围后列绝对失效等误导，补充 InnoDB 聚簇/二级和优化器成本边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=620`、`stillUnreviewed=284`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：MySQL 联合索引与 EXPLAIN 140–149

- 新增 10 道 MySQL UUID 审校补丁：最左前缀、联合索引场景、IN/范围条件、LIKE、索引下推、EXPLAIN 和多列条件。同步修订四级答案和 Recall 关键点。
- 重点修正跳过最左列必然完全不走索引、范围后列绝对失效、LIKE 前缀一定使用索引、ICP 等同于查找边界等误导；明确区分索引查找、扫描、过滤、覆盖和实际执行计划。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=630`、`stillUnreviewed=274`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：MySQL 锁基础 150–153

- 新增 4 道 MySQL UUID 审校补丁：锁分类、全局锁、表锁/MDL 和行锁。同步修订四级答案和 Recall 关键点。
- 重点修正把行锁说成物理行、把全局锁等同只读配置、把 MDL 与数据锁混淆以及忽略索引/隔离级别影响等误导；明确 InnoDB 锁定索引记录或范围的边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=634`、`stillUnreviewed=270`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：MySQL 事务锁细节 154–163

- 新增 10 道 MySQL UUID 审校补丁：`SELECT ... FOR UPDATE`、记录/间隙/临键锁、意向锁、乐观/悲观锁、库存超卖和死锁。同步修订四级答案和 Recall 关键点。
- 重点修正把锁定读当普通读、把间隙锁/临键锁固定化、忽略 autocommit/隔离级别/索引、应用锁替代数据库原子更新和只重试最后一条 SQL 等误导；补充事务边界、受影响行数与幂等重试。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=644`、`stillUnreviewed=260`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：MySQL ACID 164–173

- 新增 10 道 MySQL UUID 审校补丁：事务四大特性、原子性/一致性/隔离性/持久性、ACID 机制和保证方式。同步修订四级答案和 Recall 关键点。
- 重点修正把一致性归因于数据库自动保证、把持久性说成任何灾难零丢失、把快照读/当前读混淆以及把隔离性说成物理时间串行等误导；明确 undo/redo、MVCC/锁、约束、应用不变量、事务边界和故障模型。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=654`、`stillUnreviewed=250`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：MySQL 隔离级别与 MVCC 174–185

- 新增 12 道 MySQL UUID 审校补丁：autocommit、四级隔离、读未提交/已提交/可重复读/串行化、未提交值可见性、隔离级别设置、隔离实现、幻读、避免幻读和当前读。同步修订四级答案和 Recall 关键点。
- 重点修正把隔离级别行为固定化、忽略语句类型/事务边界、把快照读当当前读、把 RR 简化为绝对无幻读以及把当前读说成读未提交等误导；明确 Read View、记录/范围锁和会话作用域。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=666`、`stillUnreviewed=238`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：MySQL MVCC 186–193

- 新增 8 道 MySQL UUID 审校补丁：UPDATE/DELETE 当前读、快照读、MVCC、版本链、Read View、版本可见性、RR/RC 快照差异和并发读写分析。同步修订四级答案和 Recall 关键点。
- 重点修正把写操作当快照读、把 Read View 当物理副本、混淆事务 ID 可见性、把 RC 说成没有 MVCC 以及忽略时间线/当前读等误导；补充 undo 版本链、Read View 边界、活跃事务和 purge。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=674`、`stillUnreviewed=230`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：MySQL 复制与分库分表 194–203

- 新增 10 道 MySQL UUID 审校补丁：读写分离、实现方式、主从复制、复制延迟、半同步复制、分库/分表、分片策略、不停机扩容和中间件。同步修订四级答案和 Recall 关键点。
- 重点修正副本收到日志即已应用、半同步保证零丢失、SELECT 全发副本、固定分片策略和中间件自动解决一致性等误导；补充读后写一致性、GTID/位点、CDC/双写追平、灰度和回滚。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=684`、`stillUnreviewed=220`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：MySQL 分片、运维与 SQL 204–213

- 新增 10 道 MySQL UUID 审校补丁：分库分表问题、分布式 ID、Snowflake、大批量删除、大表加字段、CPU 排障、基础查询、分组统计和分组 Top-N。同步修订四级答案和 Recall 关键点。
- 重点修正把分片当成无代价优化、Snowflake 天然绝对有序、大事务删除/在线 DDL 无风险、CPU 只靠重启以及全表 LIMIT 代替分组 Top-N 等误导；补充在线迁移、MDL、CDC/校验、限流、参数化 SQL、NULL、窗口函数与并列语义。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=694`、`stillUnreviewed=210`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：MySQL 大表与深分页 214–217

- 新增 4 道 MySQL UUID 审校补丁：大表关联优化、批量导入与索引顺序、深分页。同步修订四级答案和 Recall 关键点；MySQL 源书 215/215 已进入审校投影。
- 重点修正固定“小表驱动大表”、先建/后建索引绝对化、忽略大事务与在线 DDL 风险、把深分页理解为直接跳转等误导；补充执行计划、日志/空间/恢复、在线窗口和 keyset 分页边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=698`、`stillUnreviewed=206`。Redis 与 Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Redis 基础与核心数据结构 1–12

- 新增 12 道 Redis UUID 审校补丁：Redis 定位、MySQL 对比、项目场景、部署/高可用、用途、核心类型、string/list/hash/set/zset。同步修订四级答案和 Recall 关键点。
- 重点修正 Redis 只是缓存、一定单线程、有从库就强一致、内部结构固定和大集合全量读取无代价等误导；补充持久化/复制/淘汰、TTL、原子性、内部编码、大集合成本和故障降级。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=710`、`stillUnreviewed=194`。Redis 与 Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Redis 特殊类型、I/O 与线程 13–24

- 新增 12 道 Redis UUID 审校补丁：Bitmap、HyperLogLog、GEO、hash/string 取舍、Redis 性能、I/O 多路复用、select/poll/epoll/kqueue/IOCP、事件循环、单线程和 Redis 6 网络 I/O 多线程。同步修订四级答案和 Recall 关键点。
- 重点修正固定内存/误差、把 readiness 当 completion、把单线程说成全进程单线程以及把 Redis 6 说成命令全面并行等误导；补充大 key、近似统计、慢命令、事件触发模式和网络 I/O 边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=722`、`stillUnreviewed=182`。Redis 与 Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Redis 命令与性能 25–29

- 新增 5 道 Redis UUID 审校补丁：常用命令、SET、SADD 复杂度、INCR 和 QPS。同步修订四级答案和 Recall 关键点。
- 重点修正无界 KEYS/大集合读取、SETNX+EXPIRE 竞态、复杂度固定延迟、INCR 复合原子性和固定 QPS 等误导；补充条件写入/TTL、集合扩容、整数错误、压测变量和尾延迟。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=727`、`stillUnreviewed=177`。Redis 与 Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Redis 持久化 30–36

- 新增 7 道 Redis UUID 审校补丁：RDB/AOF/混合持久化、RDB 快照与触发、AOF 与刷盘、AOF rewrite 机制和具体流程。同步修订四级答案和 Recall 关键点。
- 重点修正把快照/命令日志混淆、把 everysec 说成绝对一秒、忽略 fork/COW、增量缓冲、父进程继续服务和原子切换等误导；补充 RPO、恢复和失败回退边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=734`、`stillUnreviewed=170`。Redis 与 Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Redis 持久化恢复与配置 37–44

- 新增 8 道 Redis UUID 审校补丁：AOF 内容、rewrite 期间双写、RDB/AOF 优缺点与选型、数据恢复、混合持久化、模式设置和开发配置。同步修订四级答案和 Recall 关键点。
- 重点修正把 AOF 当内存镜像、双写当命令执行两次、everysec/混合模式绝对化、忽略恢复校验和开发生产差异等误导；补充 RESP 命令日志、RPO/RTO、版本/配置、故障回退和恢复演练。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=742`、`stillUnreviewed=162`。Redis 与 Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Redis 复制与 Sentinel 45–57

- 新增 13 道 Redis UUID 审校补丁：主从复制、作用、不一致与修复、拓扑、全量/增量同步、复制问题、脑裂、Sentinel、故障转移 leader 和新主选择。同步修订四级答案和 Recall 关键点。
- 重点修正有副本即强一致、复制零丢失、收到日志即追平、Sentinel 自动消除脑裂以及忽略 quorum/epoch/客户端切换等误导；补充 replication ID/offset/backlog、全量/增量、fencing、数据校验和故障回退。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=755`、`stillUnreviewed=149`。Redis 与 Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Redis Cluster 与缓存保护 58–71

- 新增 14 道 Redis UUID 审校补丁：Cluster、槽位分区、动态伸缩、MOVED/ASK、缓存击穿/穿透/雪崩、布隆过滤器及误判/删除/哈希表对比。同步修订四级答案和 Recall 关键点。
- 重点修正集群节点数绝对化、MOVED/ASK 混淆、三类缓存故障混淆、Bloom 无误判/可直接删除等误导；补充 slot/迁移/客户端路由、TTL/回源保护、概率结构和最终校验。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=769`、`stillUnreviewed=135`。Redis 与 Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Redis 缓存一致性与热点 73–82

- 新增 10 道 Redis UUID 审校补丁：删除或更新缓存、先写库后删缓存、高一致性、本地/分布式二级缓存、缓存组件设计、本地缓存对比、热 Key 监控/治理和大 Key。同步修订四级答案和 Recall 关键点。
- 重点修正把删缓存当强一致、Pub/Sub 当可靠失效、热 Key 与大 Key 混淆、长期 MONITOR 和直接 DEL 大对象等误导；补充并发回填、Outbox/CDC、版本、L1/L2、热点拆分和异步删除。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=779`、`stillUnreviewed=125`。Redis 与 Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Redis 缓存/队列工程 83–91

- 新增 9 道 Redis UUID 审校补丁（源书序 92 无待审投影）：缓存预热、无底洞、内存不足、过期/淘汰、LRU/LFU、阻塞、异步消息队列和延时队列。同步修订四级答案和 Recall 关键点。
- 重点修正无底洞只加节点、内存只看 used_memory、过期等于定时回调、Pub/Sub 可靠队列和 zset 自动可靠延迟消息等误导；补充限速预热、fan-out、碎片/fork、淘汰边界、Streams 确认和 zset 任务幂等。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=788`、`stillUnreviewed=116`。Redis 与 Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Redis 事务、Lua、Pipeline 与锁 93–102

- 新增 10 道 Redis UUID 审校补丁：事务原理与边界、回滚/ACID、Lua、Pipeline、底层流程、使用场景和分布式锁。同步修订四级答案和 Recall 关键点。
- 重点修正把不交错执行当完整回滚、把 Pipeline 当事务/并发执行、忽略脚本阻塞/批量背压以及用 SETNX/DEL 直接实现安全锁等误导；补充 WATCH、脚本错误、pipeline 分批、锁 token/续期和 fencing。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=798`、`stillUnreviewed=106`。Redis 与 Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Redis 分布式锁 103–110

- 新增 8 道 Redis UUID 审校补丁：SETNX 竞争、SETNX 风险与改进、Redisson、看门狗、Redlock、红锁边界和项目落地。同步修订四级答案和 Recall 关键点。
- 重点修正 SETNX 即完整锁、看门狗/Redlock 百分百安全、脚本原子等于生命周期原子以及忽略 fencing/旧持有者等误导；补充 token/TTL/续期、暂停/故障切换、强一致协调和如实项目描述。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=806`、`stillUnreviewed=98`。Redis 与 Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Redis 底层结构 111–124

- 新增 14 道 Redis UUID 审校补丁：SDS、dict、链表/intset、zset、listpack/ziplist 连锁更新、跳表/span 和范围查询。同步修订四级答案和 Recall 关键点。
- 重点修正把历史 ziplist/链表结构当作 Redis 7 固定实现、把 zset 简化成跳表、把 span 当字节长度和把期望复杂度绝对化等误导；补充版本/阈值、紧凑编码、quicklist、dict/skiplist 和范围返回成本。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=821`、`stillUnreviewed=83`。Redis 与 Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Redis 底层/秒杀/限流 125–134

- 新增 10 道 Redis UUID 审校补丁：span/range、ziplist/listpack、quicklist、LZF、前缀扫描、秒杀、削峰和限流。同步修订四级答案和 Recall 关键点；Redis 源书 134/134 已进入审校投影。
- 重点修正 ziplist 65535 计数边界、无界 KEYS、Redis 扣减等于交易完成、无限队列削峰和限流算法绝对化等误导；补充版本/阈值、SCAN 幂等、队列消费、数据库事实源、积压和令牌桶/窗口边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=830`、`stillUnreviewed=74`。Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Spring 基础 1–9

- 新增 9 道 Spring UUID 审校补丁：框架定位与特性、AOP/IoC、源码刷新主线、模块、常用注解、设计模式、容器单例和 Spring/Web 容器边界。同步修订四级答案和 Recall 关键点。
- 重点修正把 Spring Boot/Cloud 等同 Spring Framework、把 IoC 与 AOP 混为一谈、把 AOP 说成无边界拦截、把 Spring 单例说成 JVM 全局单例，以及混淆 Spring 容器与 Web 容器等误导；补充代理自调用、BeanFactory 作用域、WebApplicationContext 和版本边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=839`、`stillUnreviewed=65`。审计候选降至 5 个，Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Spring IoC/Bean 11–20、22–26

- 新增 13 道 Spring UUID 审校补丁：IoC/DI、使用收益、实现机制、手写容器边界、BeanFactory/ApplicationContext、启动流程、实例化方式、Bean 定义、@Component/@Bean、Aware、初始化/销毁、构造器注入、@Autowired/@Resource 和 Autowired 处理器。同步修订四级答案和 Recall 关键点。
- 重点修正把 DI 等同 IoC、把容器简化为直接 new、把 ApplicationContext 与 BeanFactory 能力倒置、把 prototype 自动销毁、字段注入无代价以及注入规则绝对化等误导；补充作用域、FactoryBean、后置处理器、循环依赖、代理和版本边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=854`、`stillUnreviewed=50`。审计候选降至 4 个，Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Spring 自动装配/循环依赖/AOP 27–39

- 新增 12 道 Spring UUID 审校补丁：自动装配与 XML 模式、Bean 作用域、单例线程安全、循环依赖、三级缓存、AOP 核心概念和代理/织入方式。同步修订四级答案和 Recall 关键点；源书序 33 无待审投影。
- 重点修正把自动装配说成固定按字段名、把作用域当线程安全、把三级缓存当通用循环依赖解法、把早期引用说成所有场景可用，以及把 Spring 运行期代理叫成 AspectJ 编译织入等误导；补充 scoped proxy、构造器/prototype 限制、无状态设计和编译/加载期织入边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=866`、`stillUnreviewed=38`。审计候选降至 3 个，Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Spring AOP/事务 40–58

- 新增 16 道 Spring UUID 审校补丁：AspectJ、通知类型与执行时机、AOP 总结/OOP 关系、Spring AOP 与 AspectJ/反射、JDK/类代理、代理选择与示例、事务实现/失效、隔离级别、传播机制、跨线程及 protected/private 边界。同步修订四级答案和 Recall 关键点。
- 重点修正通知执行时机、代理与织入概念、Spring AOP 与 AspectJ/反射的关系、异常回滚规则、线程绑定、数据库隔离实现、自调用和访问修饰符边界；同时压缩 AOP 织入和通知长答，避免面试答案过度冗长。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=884`、`stillUnreviewed=20`。审计候选降至 1 个，Spring 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Spring MVC/Boot 59–64、66–72

- 新增 13 道 Spring UUID 审校补丁：MVC 核心组件/请求流程、HandlerAdapter、REST、Boot 定位/注解/Starter/自动配置/启动/主类/扫描路径、Boot 与 MVC/Spring 区别；源书序 65 无待审投影。同步修订四级答案和 Recall 关键点。
- 重点修正把 HandlerMapping 和 HandlerAdapter 混为一谈、把 Boot 当 MVC、把启动类说成扫描 main、把组件扫描等同自动配置以及把 REST 简化成返回 JSON 等误导；补充消息转换、条件自动配置、primary source、包扫描根和 Web 栈边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=897`、`stillUnreviewed=7`。审计候选已降为 0，Spring 仍有 7 道未完成逐题审查，尚未运行完整质量门、Seed、真实 Recall 或部署。

## 2026-09-21 继续全量审校：Spring Cloud/微服务/任务/缓存 73–79

- 新增 7 道 Spring UUID 审校补丁：Spring Cloud 定位、微服务边界、SpringTask 调度与替代方案、Spring Cache、Cache 与 Redis 分层和共存理由。同步修订四级答案和 Recall 关键点。
- 重点修正把 Spring Cloud 当单一运行时、把微服务简化成拆进程、把定时任务替换等同资源治理、把 Spring Cache 与 Redis 当同层产品，以及把缓存抽象当成自动一致性方案等误导；补充版本/BOM、分布式失败、集群幂等、队列背压和缓存一致性边界。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=904`、`stillUnreviewed=0`，审计候选为 0。全量文件审校完成，进入 `knowledge:audit:report`、`seed:check`、质量门、数据库 Seed、真实 Recall 和部署验收；生产题库仍未修改。

## 2026-09-21 全量审校本地验收

- `knowledge:audit:report` 通过并生成 `output/knowledge-audit.json`：904/904 人工审校、0 未审、0 候选；`seed:check` 通过并核对 100 算法、165 主题、904 题、120 核心题和 904 条清洗详答。
- 首轮质量门发现并修复一处回归测试箭头语法、一处全量 JSON 联合类型收窄，以及 3 个随答案更新而过时的文案断言和 1 个假设仍有未审题目的断言。修复后便携 Node 24.19 下 lint、typecheck、test、build 全部通过：38 个测试文件、369 项测试、239 个生成页面。
- 本轮仍未执行数据库 Seed、测试库备份、真实账号 Recall/刷新历史回归或部署；原始题库、学习历史和生产数据库未修改，当前是文件级审校与本地质量门通过，不等于生产验收。

## 2026-09-20 继续全量审校：MySQL redo/慢 SQL 69–80

- 新增 12 道 MySQL UUID 审校补丁：MTR、redo block、LSN、checkpoint、redo 调优、慢 SQL、执行过程、优化方法、慢日志和覆盖索引。同步修订四级答案和 Recall 关键点。
- 重点修正 redo block 与原子写、MTR 与 SQL 事务、LSN/物理地址、checkpoint/commit、固定调优值、慢 SQL 单一阈值、慢日志开关和“有索引即覆盖”等混淆。
- 便携 Node 24.19 实测补丁 JSON 解析与 `scripts/audit-knowledge.mjs` 通过：904 道、核心 120 道，`manuallyReviewed=563`、`stillUnreviewed=341`。MySQL 仍未完成全分类审查，尚未运行完整质量门、Seed、真实 Recall 或部署。
