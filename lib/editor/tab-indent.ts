/**
 * 代码编辑区的 Tab 处理。
 *
 * 原生 textarea 按 Tab 会把焦点移出输入框，写代码时非常碍事。
 * 这里把 Tab 转成缩进、Shift+Tab 转成反缩进，并保持选区可预期。
 *
 * 纯函数实现，不依赖 DOM，便于单测。
 */

/** Java 惯用缩进。 */
export const CODE_INDENT = "    ";

/** 单行反缩进最多移除的字符数（一个缩进宽度，或一个制表符）。 */
const MAX_OUTDENT = CODE_INDENT.length;

export type TabIndentInput = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  outdent?: boolean;
};

export type TabIndentResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  /**
   * 当整个编辑可以表达成"用一段文本替换当前选区"时为该文本，否则为 null。
   * 调用方据此决定能否走原生 insertText（保留撤销栈与光标）。
   */
  replacement: string | null;
};

function lineStartOf(value: string, index: number) {
  const lineFeed = value.lastIndexOf("\n", Math.max(0, index - 1));
  return lineFeed === -1 ? 0 : lineFeed + 1;
}

function lineEndOf(value: string, index: number) {
  const lineFeed = value.indexOf("\n", index);
  return lineFeed === -1 ? value.length : lineFeed;
}

function indentBlock(block: string) {
  return block
    .split("\n")
    .map((line) => CODE_INDENT + line)
    .join("\n");
}

function outdentBlock(block: string) {
  return block
    .split("\n")
    .map((line) => {
      if (line.startsWith("\t")) return line.slice(1);
      let removed = 0;
      while (removed < MAX_OUTDENT && line[removed] === " ") removed += 1;
      return line.slice(removed);
    })
    .join("\n");
}

export function computeTabIndent({
  value,
  selectionStart,
  selectionEnd,
  outdent = false,
}: TabIndentInput): TabIndentResult {
  if (
    !Number.isSafeInteger(selectionStart)
    || !Number.isSafeInteger(selectionEnd)
    || selectionStart < 0
    || selectionEnd < selectionStart
    || selectionEnd > value.length
  ) {
    throw new RangeError("selection must be a valid range inside value");
  }

  // 光标处：直接插入或移除一个缩进宽度。
  if (selectionStart === selectionEnd) {
    if (!outdent) {
      return {
        value: value.slice(0, selectionStart) + CODE_INDENT + value.slice(selectionStart),
        selectionStart: selectionStart + CODE_INDENT.length,
        selectionEnd: selectionStart + CODE_INDENT.length,
        replacement: CODE_INDENT,
      };
    }
    const lineStart = lineStartOf(value, selectionStart);
    let removable = 0;
    if (selectionStart > lineStart && value[selectionStart - 1] === "\t") {
      // 该行用制表符缩进时，一次退一级。
      removable = 1;
    } else {
      while (
        removable < MAX_OUTDENT
        && selectionStart - removable - 1 >= lineStart
        && value[selectionStart - removable - 1] === " "
      ) {
        removable += 1;
      }
    }
    if (removable === 0) {
      return { value, selectionStart, selectionEnd, replacement: null };
    }
    return {
      value: value.slice(0, selectionStart - removable) + value.slice(selectionStart),
      selectionStart: selectionStart - removable,
      selectionEnd: selectionStart - removable,
      replacement: null,
    };
  }

  // 选中内容：整行伸缩，并把选区保持在被修改的整块上。
  const blockStart = lineStartOf(value, selectionStart);
  const blockEnd = lineEndOf(value, selectionEnd);
  const block = value.slice(blockStart, blockEnd);
  const nextBlock = outdent ? outdentBlock(block) : indentBlock(block);
  if (nextBlock === block) {
    return { value, selectionStart, selectionEnd, replacement: null };
  }

  return {
    value: value.slice(0, blockStart) + nextBlock + value.slice(blockEnd),
    selectionStart: blockStart,
    selectionEnd: blockStart + nextBlock.length,
    replacement: null,
  };
}
