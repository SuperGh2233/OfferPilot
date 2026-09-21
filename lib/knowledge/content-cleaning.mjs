/**
 * Preserve the source corpus verbatim: the cleanup is a reversible projection.
 * Only remove a proven author/promotion footer after an explicit chapter-ending
 * marker, never a technical paragraph merely because it mentions a link/PDF.
 */
export function cleanKnowledgeFullAnswer(answer) {
  if (typeof answer !== "string") return answer;
  const lines = answer.replace(/\r\n?/g, "\n").split("\n");
  const footer = lines.findIndex((line) => {
    const text = line.trim();
    return /^说一点心里话[。！!]?$/.test(text)
      || /^面渣逆袭.{0,45}篇第二版终于整理完了[，,]说一点心里话[。！!]?$/.test(text)
      || /^整整.{0,100}面渣逆袭.{0,45}篇第二版终于整理完了/.test(text);
  });
  if (footer < 0) return answer;
  // Avoid deleting a quoted sentence or legitimate answer without a marketing tail.
  const tail = lines.slice(footer + 1).join("\n");
  if (!/(?:公众号|星球|面渣逆袭|面经|PDF|转载链接)/.test(tail)) return answer;
  let end = footer;
  if (end > 0 && /^20\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日第二版优化结束[。.]?$/.test(lines[end - 1].trim())) {
    end -= 1;
  }
  return lines.slice(0, end).join("\n").trimEnd();
}

/**
 * Repair mechanical punctuation artifacts produced by the EPUB summarizer.
 * Avoid touching Java/SQL syntax, wording, scoring points or sentence order.
 */
export function cleanKnowledgeSummary(text) {
  return text.replace(/：。/g, "：").replace(/。{2,}/g, "。").trim();
}

/**
 * An explicit, question-ID-scoped human review. No heuristic rewriting of
 * keyword points or unrelated technical content. Unknown fields are retained.
 */
export function applyKnowledgeContentReview(question, patch) {
  const edited = { ...question };
  if (patch) {
    for (const field of ["short_answer", "interview_answer", "full_answer", "key_points", "keyword_aliases", "answer_status"]) {
      if (Object.hasOwn(patch, field)) edited[field] = patch[field];
    }
    for (const [before, after] of patch.replace ?? []) {
      if (!before || typeof after !== "string") throw new Error(`Invalid review replacement for ${question.id}`);
      for (const field of ["short_answer", "interview_answer", "full_answer"]) {
        edited[field] = edited[field].replaceAll(before, after);
      }
      edited.key_points = edited.key_points.map((point) => point.replaceAll(before, after));
    }
  }
  edited.short_answer = cleanKnowledgeSummary(edited.short_answer);
  edited.interview_answer = cleanKnowledgeSummary(edited.interview_answer);
  edited.full_answer = cleanKnowledgeFullAnswer(edited.full_answer);
  return edited;
}
