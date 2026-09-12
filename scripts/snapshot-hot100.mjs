import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://leetcode.cn/studyplan/top-100-liked/";
const SNAPSHOT_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
}).format(new Date());
const weekByGroup = new Map([
  ["哈希", 1],
  ["双指针", 1],
  ["滑动窗口", 1],
  ["子串", 1],
  ["普通数组", 1],
  ["矩阵", 1],
  ["链表", 1],
  ["栈", 1],
  ["技巧", 1],
  ["二叉树", 2],
  ["图论", 2],
  ["回溯", 2],
  ["二分查找", 3],
  ["堆", 3],
  ["贪心算法", 3],
  ["动态规划", 3],
  ["多维动态规划", 3],
]);

const response = await fetch(SOURCE_URL, {
  headers: { "user-agent": "OfferPilot Hot100 snapshot builder" },
});
if (!response.ok) throw new Error(`LeetCode returned HTTP ${response.status}`);

const html = await response.text();
const match = html.match(
  /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
);
if (!match) throw new Error("LeetCode page did not contain __NEXT_DATA__");

const nextData = JSON.parse(match[1]);
const queries = nextData?.props?.pageProps?.dehydratedState?.queries ?? [];
const detail = queries
  .map((query) => query?.state?.data?.studyPlanV2Detail)
  .find((value) => value?.slug === "top-100-liked");
if (!detail) throw new Error("LeetCode Hot100 study plan data was not found");

let orderIndex = 0;
const problems = detail.planSubGroups.flatMap((group) => {
  const recommendedWeek = weekByGroup.get(group.name);
  if (!recommendedWeek) throw new Error(`Unmapped Hot100 group: ${group.name}`);

  return group.questions.map((question) => ({
    leetcode_id: Number(question.questionFrontendId),
    title: question.translatedTitle,
    title_en: question.title,
    difficulty: question.difficulty.toLowerCase(),
    url: `https://leetcode.cn/problems/${question.titleSlug}/`,
    tags: [
      ...new Set([
        group.name,
        ...question.topicTags.map((tag) => tag.nameTranslated || tag.name),
      ]),
    ],
    recommended_week: recommendedWeek,
    importance: 3,
    order_index: ++orderIndex,
  }));
});

if (problems.length !== 100) {
  throw new Error(`Expected 100 Hot100 problems, received ${problems.length}`);
}
if (new Set(problems.map((problem) => problem.leetcode_id)).size !== 100) {
  throw new Error("Hot100 contains duplicate frontend IDs");
}

const output = {
  schema_version: "1.0",
  source_name: detail.name,
  source_url: SOURCE_URL,
  snapshot_date: SNAPSHOT_DATE,
  source_description: detail.highlight,
  problem_count: problems.length,
  problems,
};
const outputPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../data/algorithm/hot100.json",
);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Saved ${problems.length} problems to ${outputPath}`);
