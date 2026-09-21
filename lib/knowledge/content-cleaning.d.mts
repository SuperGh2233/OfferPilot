export type ReviewableQuestion = {
  id: string;
  short_answer: string;
  interview_answer: string;
  full_answer: string;
  key_points: string[];
  keyword_aliases: Record<string, string[]>;
  answer_status?: "available" | "container_only";
};
export type KnowledgeContentPatch = Partial<Pick<ReviewableQuestion,
  "short_answer" | "interview_answer" | "full_answer" | "key_points" | "keyword_aliases" | "answer_status"
>> & { replace?: readonly (readonly [string, string])[] };
export function cleanKnowledgeFullAnswer(answer: string): string;
export function cleanKnowledgeSummary(text: string): string;
export function applyKnowledgeContentReview<T extends ReviewableQuestion>(
  question: T, patch?: KnowledgeContentPatch,
): T;
