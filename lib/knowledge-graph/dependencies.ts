import type { KnowledgeGraphTopicInput } from "./model";

export type KnowledgeTopicDependencyEdge = {
  prerequisiteTopicId: string;
  topicId: string;
};

export type KnowledgeTopicDependencyNode = {
  topicId: string;
  name: string;
  category: string;
  prerequisiteTopicIds: readonly string[];
  dependentTopicIds: readonly string[];
  depth: number;
};

export type KnowledgeTopicDependencyGraph = {
  nodes: readonly KnowledgeTopicDependencyNode[];
  edges: readonly KnowledgeTopicDependencyEdge[];
  topologicalTopicIds: readonly string[];
};

type TopicRef = readonly [category: string, name: string];
type DependencySpec = {
  topic: TopicRef;
  prerequisites: readonly TopicRef[];
};

const D = (category: string, name: string): TopicRef => [category, name];

const DEPENDENCIES: readonly DependencySpec[] = [
  // Java 基础
  { topic: D("Java基础", "JDK"), prerequisites: [D("Java基础", "Java 概述")] },
  { topic: D("Java基础", "基础语法"), prerequisites: [D("Java基础", "Java 概述")] },
  { topic: D("Java基础", "数据类型"), prerequisites: [D("Java基础", "基础语法")] },
  { topic: D("Java基础", "面向对象"), prerequisites: [D("Java基础", "基础语法")] },
  { topic: D("Java基础", "Object"), prerequisites: [D("Java基础", "面向对象")] },
  { topic: D("Java基础", "继承"), prerequisites: [D("Java基础", "面向对象")] },
  { topic: D("Java基础", "多态"), prerequisites: [D("Java基础", "继承")] },
  { topic: D("Java基础", "抽象类"), prerequisites: [D("Java基础", "面向对象")] },
  { topic: D("Java基础", "接口"), prerequisites: [D("Java基础", "面向对象")] },
  { topic: D("Java基础", "重载"), prerequisites: [D("Java基础", "面向对象")] },
  { topic: D("Java基础", "final"), prerequisites: [D("Java基础", "面向对象")] },
  { topic: D("Java基础", "static"), prerequisites: [D("Java基础", "基础语法")] },
  { topic: D("Java基础", "equals"), prerequisites: [D("Java基础", "Object")] },
  { topic: D("Java基础", "hashCode"), prerequisites: [D("Java基础", "equals")] },
  { topic: D("Java基础", "String"), prerequisites: [D("Java基础", "Object"), D("Java基础", "数据类型")] },
  { topic: D("Java基础", "StringBuilder"), prerequisites: [D("Java基础", "String")] },
  { topic: D("Java基础", "StringBuffer"), prerequisites: [D("Java基础", "String")] },
  { topic: D("Java基础", "Integer"), prerequisites: [D("Java基础", "数据类型")] },
  { topic: D("Java基础", "自动拆箱"), prerequisites: [D("Java基础", "Integer")] },
  { topic: D("Java基础", "泛型"), prerequisites: [D("Java基础", "面向对象")] },
  { topic: D("Java基础", "注解"), prerequisites: [D("Java基础", "基础语法")] },
  { topic: D("Java基础", "反射"), prerequisites: [D("Java基础", "Object"), D("Java基础", "注解")] },
  { topic: D("Java基础", "异常"), prerequisites: [D("Java基础", "基础语法")] },
  { topic: D("Java基础", "IO"), prerequisites: [D("Java基础", "基础语法")] },
  { topic: D("Java基础", "I/O"), prerequisites: [D("Java基础", "基础语法")] },
  { topic: D("Java基础", "NIO"), prerequisites: [D("Java基础", "IO")] },
  { topic: D("Java基础", "序列化"), prerequisites: [D("Java基础", "IO"), D("Java基础", "Object")] },
  { topic: D("Java基础", "网络编程"), prerequisites: [D("Java基础", "IO")] },
  { topic: D("Java基础", "Lambda"), prerequisites: [D("Java基础", "接口")] },
  { topic: D("Java基础", "Stream"), prerequisites: [D("Java基础", "Lambda")] },

  // Java 集合
  { topic: D("Java集合", "Collection"), prerequisites: [D("Java集合", "引言")] },
  { topic: D("Java集合", "ArrayList"), prerequisites: [D("Java集合", "Collection")] },
  { topic: D("Java集合", "LinkedList"), prerequisites: [D("Java集合", "Collection")] },
  { topic: D("Java集合", "Map"), prerequisites: [D("Java集合", "Collection")] },
  { topic: D("Java集合", "红黑树"), prerequisites: [D("Java集合", "Collection")] },
  { topic: D("Java集合", "HashMap"), prerequisites: [D("Java集合", "Map"), D("Java基础", "hashCode"), D("Java基础", "equals")] },
  { topic: D("Java集合", "HashSet"), prerequisites: [D("Java集合", "HashMap")] },
  { topic: D("Java集合", "LinkedHashMap"), prerequisites: [D("Java集合", "HashMap")] },
  { topic: D("Java集合", "TreeMap"), prerequisites: [D("Java集合", "Map"), D("Java集合", "红黑树")] },
  { topic: D("Java集合", "fail-fast"), prerequisites: [D("Java集合", "Collection")] },
  { topic: D("Java集合", "CopyOnWriteArrayList"), prerequisites: [D("Java集合", "ArrayList")] },

  // Java 并发
  { topic: D("Java并发", "线程"), prerequisites: [D("Java并发", "基础")] },
  { topic: D("Java并发", "并发"), prerequisites: [D("Java并发", "线程")] },
  { topic: D("Java并发", "Java 内存模型"), prerequisites: [D("Java并发", "并发")] },
  { topic: D("Java并发", "内存模型"), prerequisites: [D("Java并发", "Java 内存模型")] },
  { topic: D("Java并发", "可见性"), prerequisites: [D("Java并发", "Java 内存模型")] },
  { topic: D("Java并发", "volatile"), prerequisites: [D("Java并发", "Java 内存模型"), D("Java并发", "可见性")] },
  { topic: D("Java并发", "原子性"), prerequisites: [D("Java并发", "并发")] },
  { topic: D("Java并发", "CAS"), prerequisites: [D("Java并发", "原子性")] },
  { topic: D("Java并发", "AtomicInteger"), prerequisites: [D("Java并发", "CAS")] },
  { topic: D("Java并发", "ABA"), prerequisites: [D("Java并发", "CAS")] },
  { topic: D("Java并发", "锁"), prerequisites: [D("Java并发", "并发")] },
  { topic: D("Java并发", "synchronized"), prerequisites: [D("Java并发", "锁"), D("Java并发", "Java 内存模型")] },
  { topic: D("Java并发", "AQS"), prerequisites: [D("Java并发", "锁"), D("Java并发", "CAS")] },
  { topic: D("Java并发", "ReentrantLock"), prerequisites: [D("Java并发", "AQS")] },
  { topic: D("Java并发", "CountDownLatch"), prerequisites: [D("Java并发", "AQS")] },
  { topic: D("Java并发", "CyclicBarrier"), prerequisites: [D("Java并发", "AQS")] },
  { topic: D("Java并发", "Semaphore"), prerequisites: [D("Java并发", "AQS")] },
  { topic: D("Java并发", "并发工具类"), prerequisites: [D("Java并发", "AQS")] },
  { topic: D("Java并发", "线程池"), prerequisites: [D("Java并发", "线程")] },
  { topic: D("Java并发", "CompletableFuture"), prerequisites: [D("Java并发", "线程池")] },
  { topic: D("Java并发", "ThreadLocal"), prerequisites: [D("Java并发", "线程")] },
  { topic: D("Java并发", "死锁"), prerequisites: [D("Java并发", "锁")] },
  { topic: D("Java并发", "ConcurrentHashMap"), prerequisites: [D("Java集合", "HashMap"), D("Java并发", "CAS"), D("Java并发", "synchronized")] },
  { topic: D("Java并发", "并发容器和框架"), prerequisites: [D("Java并发", "ConcurrentHashMap")] },
  { topic: D("Java并发", "协程"), prerequisites: [D("Java并发", "线程")] },

  // JVM
  { topic: D("JVM", "内存管理"), prerequisites: [D("JVM", "JVM")] },
  { topic: D("JVM", "程序计数器"), prerequisites: [D("JVM", "内存管理")] },
  { topic: D("JVM", "虚拟机栈"), prerequisites: [D("JVM", "内存管理")] },
  { topic: D("JVM", "本地方法栈"), prerequisites: [D("JVM", "内存管理")] },
  { topic: D("JVM", "堆"), prerequisites: [D("JVM", "内存管理")] },
  { topic: D("JVM", "方法区"), prerequisites: [D("JVM", "内存管理")] },
  { topic: D("JVM", "元空间"), prerequisites: [D("JVM", "方法区")] },
  { topic: D("JVM", "对象创建"), prerequisites: [D("JVM", "堆")] },
  { topic: D("JVM", "对象头"), prerequisites: [D("JVM", "对象创建")] },
  { topic: D("JVM", "逃逸分析"), prerequisites: [D("JVM", "对象创建")] },
  { topic: D("JVM", "引用"), prerequisites: [D("JVM", "对象创建")] },
  { topic: D("JVM", "可达性分析"), prerequisites: [D("JVM", "引用")] },
  { topic: D("JVM", "垃圾回收"), prerequisites: [D("JVM", "可达性分析"), D("JVM", "堆")] },
  { topic: D("JVM", "垃圾收集"), prerequisites: [D("JVM", "垃圾回收")] },
  { topic: D("JVM", "GC"), prerequisites: [D("JVM", "垃圾回收")] },
  { topic: D("JVM", "Serial"), prerequisites: [D("JVM", "垃圾收集")] },
  { topic: D("JVM", "Parallel"), prerequisites: [D("JVM", "垃圾收集")] },
  { topic: D("JVM", "CMS"), prerequisites: [D("JVM", "垃圾收集")] },
  { topic: D("JVM", "G1"), prerequisites: [D("JVM", "垃圾收集")] },
  { topic: D("JVM", "ZGC"), prerequisites: [D("JVM", "垃圾收集")] },
  { topic: D("JVM", "JVM 调优"), prerequisites: [D("JVM", "GC"), D("JVM", "内存管理")] },
  { topic: D("JVM", "类加载"), prerequisites: [D("JVM", "JVM")] },
  { topic: D("JVM", "类加载器"), prerequisites: [D("JVM", "类加载")] },
  { topic: D("JVM", "类加载机制"), prerequisites: [D("JVM", "类加载器")] },
  { topic: D("JVM", "双亲委派"), prerequisites: [D("JVM", "类加载器")] },

  // Spring
  { topic: D("Spring", "IoC"), prerequisites: [D("Spring", "Spring")] },
  { topic: D("Spring", "Spring IoC"), prerequisites: [D("Spring", "IoC")] },
  { topic: D("Spring", "Bean"), prerequisites: [D("Spring", "IoC")] },
  { topic: D("Spring", "BeanFactory"), prerequisites: [D("Spring", "Bean")] },
  { topic: D("Spring", "循环依赖"), prerequisites: [D("Spring", "Bean")] },
  { topic: D("Spring", "三级缓存"), prerequisites: [D("Spring", "循环依赖")] },
  { topic: D("Spring", "AOP"), prerequisites: [D("Spring", "Spring")] },
  { topic: D("Spring", "Spring AOP"), prerequisites: [D("Spring", "AOP")] },
  { topic: D("Spring", "事务"), prerequisites: [D("Spring", "AOP"), D("Spring", "Bean")] },
  { topic: D("Spring", "@Transactional"), prerequisites: [D("Spring", "事务")] },
  { topic: D("Spring", "Spring MVC"), prerequisites: [D("Spring", "Spring")] },
  { topic: D("Spring", "Spring Boot"), prerequisites: [D("Spring", "IoC"), D("Spring", "Spring MVC")] },

  // MySQL
  { topic: D("MySQL", "MySQL"), prerequisites: [D("MySQL", "MySQL 基础")] },
  { topic: D("MySQL", "SQL"), prerequisites: [D("MySQL", "MySQL 基础")] },
  { topic: D("MySQL", "count"), prerequisites: [D("MySQL", "SQL")] },
  { topic: D("MySQL", "varchar"), prerequisites: [D("MySQL", "SQL")] },
  { topic: D("MySQL", "连接"), prerequisites: [D("MySQL", "SQL")] },
  { topic: D("MySQL", "分页"), prerequisites: [D("MySQL", "SQL")] },
  { topic: D("MySQL", "范式"), prerequisites: [D("MySQL", "MySQL 基础")] },
  { topic: D("MySQL", "数据库架构"), prerequisites: [D("MySQL", "MySQL")] },
  { topic: D("MySQL", "存储引擎"), prerequisites: [D("MySQL", "数据库架构")] },
  { topic: D("MySQL", "InnoDB"), prerequisites: [D("MySQL", "存储引擎")] },
  { topic: D("MySQL", "B+树"), prerequisites: [D("MySQL", "InnoDB")] },
  { topic: D("MySQL", "索引"), prerequisites: [D("MySQL", "B+树")] },
  { topic: D("MySQL", "主键"), prerequisites: [D("MySQL", "索引")] },
  { topic: D("MySQL", "联合索引"), prerequisites: [D("MySQL", "索引")] },
  { topic: D("MySQL", "最左前缀"), prerequisites: [D("MySQL", "联合索引")] },
  { topic: D("MySQL", "覆盖索引"), prerequisites: [D("MySQL", "联合索引")] },
  { topic: D("MySQL", "回表"), prerequisites: [D("MySQL", "索引")] },
  { topic: D("MySQL", "Explain"), prerequisites: [D("MySQL", "SQL"), D("MySQL", "索引")] },
  { topic: D("MySQL", "事务"), prerequisites: [D("MySQL", "InnoDB")] },
  { topic: D("MySQL", "ACID"), prerequisites: [D("MySQL", "事务")] },
  { topic: D("MySQL", "隔离级别"), prerequisites: [D("MySQL", "事务")] },
  { topic: D("MySQL", "锁"), prerequisites: [D("MySQL", "事务"), D("MySQL", "InnoDB")] },
  { topic: D("MySQL", "MVCC"), prerequisites: [D("MySQL", "隔离级别"), D("MySQL", "InnoDB")] },
  { topic: D("MySQL", "ReadView"), prerequisites: [D("MySQL", "MVCC")] },
  { topic: D("MySQL", "日志"), prerequisites: [D("MySQL", "InnoDB")] },
  { topic: D("MySQL", "redo log"), prerequisites: [D("MySQL", "日志")] },
  { topic: D("MySQL", "binlog"), prerequisites: [D("MySQL", "日志")] },
  { topic: D("MySQL", "主从复制"), prerequisites: [D("MySQL", "binlog")] },
  { topic: D("MySQL", "高可用"), prerequisites: [D("MySQL", "主从复制")] },
  { topic: D("MySQL", "分库分表"), prerequisites: [D("MySQL", "MySQL")] },
  { topic: D("MySQL", "运维"), prerequisites: [D("MySQL", "MySQL")] },

  // Redis
  { topic: D("Redis", "String"), prerequisites: [D("Redis", "Redis")] },
  { topic: D("Redis", "List"), prerequisites: [D("Redis", "Redis")] },
  { topic: D("Redis", "Set"), prerequisites: [D("Redis", "Redis")] },
  { topic: D("Redis", "ZSet"), prerequisites: [D("Redis", "Redis")] },
  { topic: D("Redis", "Bitmap"), prerequisites: [D("Redis", "Redis")] },
  { topic: D("Redis", "HyperLogLog"), prerequisites: [D("Redis", "Redis")] },
  { topic: D("Redis", "GEO"), prerequisites: [D("Redis", "Redis")] },
  { topic: D("Redis", "底层结构"), prerequisites: [D("Redis", "Redis")] },
  { topic: D("Redis", "跳表"), prerequisites: [D("Redis", "ZSet"), D("Redis", "底层结构")] },
  { topic: D("Redis", "IO多路复用"), prerequisites: [D("Redis", "Redis")] },
  { topic: D("Redis", "epoll"), prerequisites: [D("Redis", "IO多路复用")] },
  { topic: D("Redis", "持久化"), prerequisites: [D("Redis", "Redis")] },
  { topic: D("Redis", "RDB"), prerequisites: [D("Redis", "持久化")] },
  { topic: D("Redis", "AOF"), prerequisites: [D("Redis", "持久化")] },
  { topic: D("Redis", "主从复制"), prerequisites: [D("Redis", "持久化")] },
  { topic: D("Redis", "高可用"), prerequisites: [D("Redis", "主从复制")] },
  { topic: D("Redis", "Redis Cluster"), prerequisites: [D("Redis", "高可用")] },
  { topic: D("Redis", "缓存设计"), prerequisites: [D("Redis", "Redis")] },
  { topic: D("Redis", "缓存穿透"), prerequisites: [D("Redis", "缓存设计")] },
  { topic: D("Redis", "缓存击穿"), prerequisites: [D("Redis", "缓存设计")] },
  { topic: D("Redis", "缓存雪崩"), prerequisites: [D("Redis", "缓存设计")] },
  { topic: D("Redis", "布隆过滤器"), prerequisites: [D("Redis", "缓存穿透")] },
  { topic: D("Redis", "LRU"), prerequisites: [D("Redis", "缓存设计")] },
  { topic: D("Redis", "分布式锁"), prerequisites: [D("Redis", "String")] },
] as const;

function topicKey(category: string, name: string) {
  return `${category}\u0000${name}`;
}

export function buildKnowledgeTopicDependencyGraph(
  topics: readonly KnowledgeGraphTopicInput[],
): KnowledgeTopicDependencyGraph {
  const byKey = new Map<string, KnowledgeGraphTopicInput>();
  const byId = new Map<string, KnowledgeGraphTopicInput>();
  for (const topic of topics) {
    const key = topicKey(topic.category, topic.name);
    if (byKey.has(key)) throw new RangeError(`duplicate topic reference: ${topic.category}/${topic.name}`);
    if (byId.has(topic.id)) throw new RangeError(`duplicate topic id: ${topic.id}`);
    byKey.set(key, topic);
    byId.set(topic.id, topic);
  }

  const edges: KnowledgeTopicDependencyEdge[] = [];
  const edgeKeys = new Set<string>();
  for (const spec of DEPENDENCIES) {
    const topic = byKey.get(topicKey(...spec.topic));
    if (!topic) throw new RangeError(`dependency topic not found: ${spec.topic[0]}/${spec.topic[1]}`);
    for (const prerequisiteRef of spec.prerequisites) {
      const prerequisite = byKey.get(topicKey(...prerequisiteRef));
      if (!prerequisite) {
        throw new RangeError(`dependency prerequisite not found: ${prerequisiteRef[0]}/${prerequisiteRef[1]}`);
      }
      if (prerequisite.id === topic.id) throw new RangeError(`self dependency: ${topic.name}`);
      const edgeKey = `${prerequisite.id}->${topic.id}`;
      if (edgeKeys.has(edgeKey)) continue;
      edgeKeys.add(edgeKey);
      edges.push({ prerequisiteTopicId: prerequisite.id, topicId: topic.id });
    }
  }

  const prerequisites = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  const indegree = new Map(topics.map((topic) => [topic.id, 0]));
  for (const edge of edges) {
    prerequisites.set(edge.topicId, [...(prerequisites.get(edge.topicId) ?? []), edge.prerequisiteTopicId]);
    dependents.set(edge.prerequisiteTopicId, [...(dependents.get(edge.prerequisiteTopicId) ?? []), edge.topicId]);
    indegree.set(edge.topicId, (indegree.get(edge.topicId) ?? 0) + 1);
  }

  const sourceIndex = new Map(topics.map((topic, index) => [topic.id, index]));
  const queue = topics
    .filter((topic) => (indegree.get(topic.id) ?? 0) === 0)
    .map((topic) => topic.id)
    .sort((a, b) => (sourceIndex.get(a) ?? 0) - (sourceIndex.get(b) ?? 0));
  const topologicalTopicIds: string[] = [];
  const depth = new Map<string, number>();

  while (queue.length > 0) {
    const topicId = queue.shift()!;
    topologicalTopicIds.push(topicId);
    const currentDepth = depth.get(topicId) ?? 0;
    for (const dependentId of dependents.get(topicId) ?? []) {
      depth.set(dependentId, Math.max(depth.get(dependentId) ?? 0, currentDepth + 1));
      const nextDegree = (indegree.get(dependentId) ?? 0) - 1;
      indegree.set(dependentId, nextDegree);
      if (nextDegree === 0) {
        queue.push(dependentId);
        queue.sort((a, b) => (sourceIndex.get(a) ?? 0) - (sourceIndex.get(b) ?? 0));
      }
    }
  }

  if (topologicalTopicIds.length !== topics.length) {
    throw new RangeError("knowledge topic prerequisite graph contains a cycle");
  }

  const nodes = topologicalTopicIds.map((topicId) => {
    const topic = byId.get(topicId)!;
    return {
      topicId,
      name: topic.name,
      category: topic.category,
      prerequisiteTopicIds: prerequisites.get(topicId) ?? [],
      dependentTopicIds: dependents.get(topicId) ?? [],
      depth: depth.get(topicId) ?? 0,
    };
  });

  return { nodes, edges, topologicalTopicIds };
}
