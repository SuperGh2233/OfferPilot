import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { applyKnowledgeContentReview } from "../lib/knowledge/content-cleaning.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = async (path) =>
  JSON.parse(await readFile(resolve(root, path), "utf8"));

const categoryWeek = {
  Java基础: 1,
  Java集合: 1,
  Java并发: 2,
  JVM: 3,
  Spring: 4,
  MySQL: 4,
  Redis: 4,
};

const [hot100, knowledge, core, answerReviews] = await Promise.all([
  readJson("data/algorithm/hot100.json"),
  readJson("data/knowledge/offerpilot_bagu_full.json"),
  readJson("data/knowledge/offerpilot_bagu_core_6weeks.json"),
  readJson("data/knowledge/answer_review_patches.json"),
]);
const coreIds = new Set(core.questions.map((question) => question.id));
const coreById = new Map(core.questions.map((question) => [question.id, question]));

if (hot100.problems.length !== 100) throw new Error("Hot100 must contain 100 problems");
if (knowledge.topics.length !== 165) throw new Error("Expected 165 knowledge topics");
if (knowledge.questions.length !== 904) throw new Error("Expected 904 knowledge questions");
if (coreIds.size !== 120) throw new Error("Expected 120 core knowledge questions");

const topics = knowledge.topics.map((topic) => ({
  ...topic,
  recommended_week: categoryWeek[topic.category],
}));
const questions = knowledge.questions.map((original) => {
  const question = applyKnowledgeContentReview(original, answerReviews[original.id]);
  return ({
  ...question,
  key_point_weights: Object.fromEntries(
    question.key_points.map((_, index) => [String(index), index === 0 ? 20 : 5]),
  ),
  is_core_6weeks: coreIds.has(question.id),
  scheduled: Boolean(coreById.get(question.id)?.scheduled),
  core_followups: coreById.get(question.id)?.core_followups ?? [],
  });
});
const mainQuestions = questions.filter(
  (question) => question.question_type === "main",
);
const followUpQuestions = questions.filter(
  (question) => question.question_type === "follow_up",
);

const unique = (values) => new Set(values).size === values.length;
if (!unique(hot100.problems.map((problem) => problem.leetcode_id))) {
  throw new Error("Duplicate LeetCode IDs in Hot100");
}
if (!unique(questions.map((question) => question.id))) {
  throw new Error("Duplicate knowledge question IDs");
}

const reviewedCount = knowledge.questions.filter((item) => answerReviews[item.id]).length;
const cleanedCount = knowledge.questions.filter((item, index) => item.full_answer !== questions[index].full_answer).length;
if (Object.keys(answerReviews).length !== reviewedCount) throw new Error("Answer reviews reference unknown question IDs");
console.log(
  `Validated ${hot100.problems.length} algorithms, ${topics.length} topics, ` +
    `${questions.length} questions, ${coreIds.size} core questions; ` +
    `${reviewedCount} human-reviewed and ${cleanedCount} cleaned long answers.`,
);

if (process.argv.includes("--dry-run")) process.exit(0);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const upsert = async (table, rows, onConflict, batchSize = 250) => {
  for (let index = 0; index < rows.length; index += batchSize) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(index, index + batchSize), { onConflict });
    if (error) throw new Error(`${table} seed failed: ${error.message}`);
  }
};

await upsert("algorithm_problems", hot100.problems, "leetcode_id");
await upsert("knowledge_topics", topics, "id");
// Parent questions must exist before follow-ups because each HTTP batch is its
// own transaction, even though the self-referencing FK is deferrable.
await upsert("knowledge_questions", mainQuestions, "id");
await upsert("knowledge_questions", followUpQuestions, "id");
console.log("Seed completed successfully.");
