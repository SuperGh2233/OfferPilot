import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const root = resolve(import.meta.dirname, "..");
const readJson = async (path) =>
  JSON.parse(await readFile(resolve(root, path), "utf8"));
const [hot100, knowledge, core] = await Promise.all([
  readJson("data/algorithm/hot100.json"),
  readJson("data/knowledge/offerpilot_bagu_full.json"),
  readJson("data/knowledge/offerpilot_bagu_core_6weeks.json"),
]);

const expectations = [
  ["algorithm_problems", 100],
  ["knowledge_topics", 165],
  ["knowledge_questions", 904],
  ["knowledge_questions", 120, ["is_core_6weeks", true]],
  ["knowledge_questions", 394, ["question_type", "main"]],
  ["knowledge_questions", 510, ["question_type", "follow_up"]],
];

for (const [table, expected, filter] of expectations) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) query = query.eq(filter[0], filter[1]);

  const { count, error } = await query;
  const label = filter ? `${table}.${filter[0]}=${String(filter[1])}` : table;
  if (error) throw new Error(`${label} verification failed: ${error.message}`);
  if (count !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${String(count)}`);
  }
  console.log(`${label}: ${count}`);
}

async function loadRemoteValues(table, column, filter) {
  const values = [];
  for (let from = 0; ; from += 500) {
    let query = supabase.from(table).select(column).range(from, from + 499);
    if (filter) query = query.eq(filter[0], filter[1]);
    const { data, error } = await query;
    if (error) throw new Error(`${table}.${column} verification failed: ${error.message}`);
    const page = data.map((row) => String(row[column]));
    values.push(...page);
    if (page.length < 500) return values;
  }
}

async function verifyExactSet(label, table, column, expected, filter) {
  const actual = await loadRemoteValues(table, column, filter);
  const expectedSet = new Set(expected.map(String));
  const actualSet = new Set(actual);
  const missing = [...expectedSet].filter((value) => !actualSet.has(value));
  const extra = [...actualSet].filter((value) => !expectedSet.has(value));
  if (
    actual.length !== actualSet.size ||
    missing.length > 0 ||
    extra.length > 0
  ) {
    throw new Error(
      `${label} IDs differ: ${missing.length} missing, ${extra.length} extra, ` +
        `${actual.length - actualSet.size} duplicates`,
    );
  }
  console.log(`${label}: exact ID set verified (${actual.length})`);
}

await verifyExactSet(
  "algorithm_problems",
  "algorithm_problems",
  "leetcode_id",
  hot100.problems.map((problem) => problem.leetcode_id),
);
await verifyExactSet(
  "knowledge_topics",
  "knowledge_topics",
  "id",
  knowledge.topics.map((topic) => topic.id),
);
await verifyExactSet(
  "knowledge_questions",
  "knowledge_questions",
  "id",
  knowledge.questions.map((question) => question.id),
);
await verifyExactSet(
  "core knowledge_questions",
  "knowledge_questions",
  "id",
  core.questions.map((question) => question.id),
  ["is_core_6weeks", true],
);

console.log("Supabase catalog verification passed.");
