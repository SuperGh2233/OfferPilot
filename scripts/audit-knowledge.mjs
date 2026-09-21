import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applyKnowledgeContentReview, cleanKnowledgeFullAnswer } from "../lib/knowledge/content-cleaning.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const [full, core, reviews] = await Promise.all([
  readJson("data/knowledge/offerpilot_bagu_full.json"),
  readJson("data/knowledge/offerpilot_bagu_core_6weeks.json"),
  readJson("data/knowledge/answer_review_patches.json"),
]);
const sourceIds = new Set(full.questions.map((question) => question.id));
if (sourceIds.size !== 904 || core.questions.length !== 120 || full.questions.length !== 904) {
  throw new Error("Source catalog integrity changed; stop the audit");
}
if (Object.keys(reviews).some((id) => !sourceIds.has(id))) throw new Error("Review points to missing question ID");

const candidates = [];
let footerCleaned = 0;
let originalPromotionalFooters = 0;
for (const original of full.questions) {
  const final = applyKnowledgeContentReview(original, reviews[original.id]);
  const flags = [];
  const preCleanAnswer = reviews[original.id]?.full_answer ?? original.full_answer;
  if (cleanKnowledgeFullAnswer(original.full_answer) !== original.full_answer) originalPromotionalFooters += 1;
  if (cleanKnowledgeFullAnswer(preCleanAnswer) !== preCleanAnswer) footerCleaned += 1;
  if (final.answer_status !== "available") flags.push("answer_status:unavailable");
  if (final.key_points.length === 0) flags.push("key_points:empty");
  for (const field of ["short_answer", "interview_answer", "full_answer"]) {
    const text = final[field] ?? "";
    if (!text.trim()) flags.push(`${field}:empty`);
    if (/(?:扫码|长按识别|公众号|获取最新版|回复【|加入星球|戳\s*(?:转载|原文)链接)/.test(text)) flags.push(`${field}:promotion`);
    if (/^\s*(?:说一点心里话|面渣逆袭.{0,45}篇第二版终于)/m.test(text)) flags.push(`${field}:editorial`);
    if (field === "full_answer" && text.length > 3500) flags.push("full_answer:very_long");
    if (/java\.util\.Stream\b/.test(text)) flags.push(`${field}:incorrect_stream_package`);
  }
  if (final.key_points.some((point) => point.length > 130)) flags.push("key_points:overlong");
  if (final.key_points.some((point) => /(?:公众号|面渣逆袭|扫码|20\d\d\s*年.*(?:增补|版优化))/.test(point))) {
    flags.push("key_points:editorial");
  }
  if (flags.length > 0) candidates.push({
    id: original.id, category: original.category, question: original.question,
    sourceBook: original.source_book, sourceSection: original.source_section,
    reviewed: Boolean(reviews[original.id]), flags: [...new Set(flags)],
    lengths: {
      short: final.short_answer.length, interview: final.interview_answer.length,
      full: final.full_answer.length, keyPoints: final.key_points.length,
    },
  });
}
const summary = {
  questions: full.questions.length,
  core: core.questions.length,
  manuallyReviewed: Object.keys(reviews).length,
  stillUnreviewed: full.questions.length - Object.keys(reviews).length,
  formerlyUnavailableRestored: full.questions.filter((question) =>
    question.answer_status === "container_only"
    && applyKnowledgeContentReview(question, reviews[question.id]).answer_status === "available",
  ).length,
  originalPromotionalFooters,
  automaticallyStrippedFooters: footerCleaned,
  candidatesNeedingReview: candidates.length,
};
console.log(JSON.stringify(summary, null, 2));
console.log("Top audit candidates:");
for (const row of candidates.slice(0, 25)) console.log(`${row.id} ${row.category} ${row.question} — ${row.flags.join(", ")}`);
if (process.argv.includes("--report")) {
  const destination = resolve(root, "output/knowledge-audit.json");
  await mkdir(resolve(root, "output"), { recursive: true });
  await writeFile(destination, JSON.stringify({ summary, candidates }, null, 2) + "\n", "utf8");
  console.log(`Audit candidate report: ${destination}`);
}
