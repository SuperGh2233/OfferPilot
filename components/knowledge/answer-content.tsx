export function AnswerContent({ text }: { text: string }) {
  const parts: { code: boolean; text: string; language?: string }[] = [];
  const fences = /^[ \t]*```([^\n]*)\n([\s\S]*?)^[ \t]*```[ \t]*\r?$/gm;
  let cursor = 0;
  for (const match of text.matchAll(fences)) {
    if (match.index > cursor) parts.push({ code: false, text: text.slice(cursor, match.index) });
    parts.push({ code: true, text: match[2], language: match[1].trim() });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ code: false, text: text.slice(cursor) });
  return <div className="space-y-3 text-sm leading-7 text-foreground/80">{parts.map((part, index) => part.code ? (
    <div key={index} className="min-w-0 overflow-hidden rounded-xl border bg-muted">
      <p className="border-b px-3 py-1 text-xs text-muted-foreground">代码{part.language ? ` · ${part.language}` : ""}</p>
      <pre tabIndex={0} aria-label="参考代码" className="max-w-full overflow-x-auto p-3 font-mono text-xs leading-6"><code>{part.text}</code></pre>
    </div>
  ) : <p key={index} className="whitespace-pre-wrap break-words">{part.text}</p>)}</div>;
}
