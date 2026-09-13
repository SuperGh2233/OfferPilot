import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GRAPHQL_URL = "https://leetcode.cn/graphql";
const SOURCE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../data/algorithm/hot100.json",
);
const OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../data/algorithm/hot100-content.json",
);
const DETAIL_CONCURRENCY = 5;
const SNAPSHOT_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
}).format(new Date());

const QUESTION_DETAIL_QUERY = `
  query questionDetail($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionFrontendId
      titleSlug
      translatedContent
      codeSnippets {
        lang
        langSlug
        code
      }
    }
  }
`;

function decodeHtmlEntities(value) {
  const namedEntities = new Map([
    ["&nbsp;", " "],
    ["&amp;", "&"],
    ["&quot;", '"'],
    ["&#39;", "'"],
    ["&apos;", "'"],
    ["&lt;", "<"],
    ["&gt;", ">"],
  ]);

  return value
    .replace(/&(?:nbsp|amp|quot|#39|apos|lt|gt);/gi, (entity) => {
      return namedEntities.get(entity.toLowerCase()) ?? entity;
    })
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (entity, codePoint) => {
      const radix = codePoint.toLowerCase().startsWith("x") ? 16 : 10;
      const value = Number.parseInt(codePoint.replace(/^x/i, ""), radix);
      return value >= 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : entity;
    });
}

function htmlToPlainText(html) {
  const plainText = decodeHtmlEntities(
    html
      .replace(/\r/g, "")
      .replace(/<sup[^>]*>(.*?)<\/sup>/gis, "^$1")
      .replace(/<sub[^>]*>(.*?)<\/sub>/gis, "_$1")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(
        /<\/(?:p|div|h[1-6]|li|ul|ol|pre|blockquote|table|thead|tbody|tr)>/gi,
        "\n",
      )
      .replace(/<[^>]+>/g, ""),
  );

  return plainText
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker(),
    ),
  );
  return results;
}

async function fetchQuestionDetail(problem) {
  const titleSlug = problem.url.split("/").filter(Boolean).pop();
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "OfferPilot Hot100 snapshot builder",
    },
    body: JSON.stringify({
      query: QUESTION_DETAIL_QUERY,
      variables: { titleSlug },
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(
      payload.errors.map((error) => error.message).filter(Boolean).join("; "),
    );
  }

  const question = payload.data?.question;
  if (!question) throw new Error("question detail was empty");
  if (
    Number(question.questionFrontendId) !== problem.leetcode_id ||
    question.titleSlug !== titleSlug
  ) {
    throw new Error("question detail did not match the requested problem");
  }

  const statement = htmlToPlainText(question.translatedContent ?? "");
  const javaStarter = question.codeSnippets?.find(
    (snippet) => snippet.langSlug === "java" || snippet.lang === "Java",
  )?.code;

  if (!statement) throw new Error("translatedContent was empty");
  if (!javaStarter?.trim()) throw new Error("official Java snippet was empty");

  return {
    leetcode_id: problem.leetcode_id,
    statement,
    java_starter_code: javaStarter,
  };
}

const source = JSON.parse(await readFile(SOURCE_PATH, "utf8"));
const sourceProblems = source.problems;
if (!Array.isArray(sourceProblems) || sourceProblems.length !== 100) {
  throw new Error(
    `Expected exactly 100 source Hot100 problems, received ${sourceProblems?.length ?? 0}`,
  );
}
if (new Set(sourceProblems.map((problem) => problem.leetcode_id)).size !== 100) {
  throw new Error("Source Hot100 contains duplicate frontend IDs");
}

const unavailable = [];
const content = await mapWithConcurrency(
  sourceProblems,
  DETAIL_CONCURRENCY,
  async (problem) => {
    try {
      return await fetchQuestionDetail(problem);
    } catch (error) {
      unavailable.push(
        `#${problem.leetcode_id} ${problem.title}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  },
);

if (unavailable.length) {
  throw new Error(
    [
      `Hot100 content snapshot failed for ${unavailable.length} item(s) on ${SNAPSHOT_DATE}.`,
      ...unavailable.map((item) => `- ${item}`),
    ].join("\n"),
  );
}

if (
  content.length !== 100 ||
  content.some((problem) => !problem.statement || !problem.java_starter_code)
) {
  throw new Error(`Hot100 content snapshot on ${SNAPSHOT_DATE} contained empty fields`);
}
if (content.some((problem) => /<[^>]+>/.test(problem.statement))) {
  throw new Error(`Hot100 content snapshot on ${SNAPSHOT_DATE} contained HTML tags`);
}
if (new Set(content.map((problem) => problem.leetcode_id)).size !== 100) {
  throw new Error("Hot100 content contains duplicate frontend IDs");
}

const output = {
  schema_version: "1.0",
  source_name: source.source_name,
  source_url: source.source_url,
  snapshot_date: SNAPSHOT_DATE,
  problem_count: content.length,
  problems: content,
};
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  `Saved ${content.length} problems to ${OUTPUT_PATH} (snapshot ${SNAPSHOT_DATE}; unavailable: none)`,
);
