import { describe, expect, it } from "vitest";

import { CODE_INDENT, computeTabIndent } from "../lib/editor/tab-indent";

describe("computeTabIndent", () => {
  it("inserts an indent at a collapsed caret and moves the caret with it", () => {
    const result = computeTabIndent({ value: "int a;", selectionStart: 0, selectionEnd: 0 });

    expect(result.value).toBe(`${CODE_INDENT}int a;`);
    expect(result.selectionStart).toBe(CODE_INDENT.length);
    expect(result.replacement).toBe(CODE_INDENT);
  });

  it("inserts in the middle of a line without disturbing the rest", () => {
    const result = computeTabIndent({ value: "ab", selectionStart: 1, selectionEnd: 1 });

    expect(result.value).toBe(`a${CODE_INDENT}b`);
    expect(result.selectionStart).toBe(1 + CODE_INDENT.length);
  });

  it("indents every line touched by the selection and keeps the block selected", () => {
    const result = computeTabIndent({
      value: "if (x) {\nreturn 1;\n}",
      selectionStart: 3,
      selectionEnd: 19,
    });

    expect(result.value).toBe("    if (x) {\n    return 1;\n    }");
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(result.value.length);
    expect(result.replacement).toBeNull();
  });

  it("does not touch a line the selection only reaches at its very start", () => {
    const result = computeTabIndent({
      value: "if (x) {\nreturn 1;\n}",
      selectionStart: 3,
      selectionEnd: 12,
    });

    expect(result.value).toBe("    if (x) {\n    return 1;\n}");
    // 选区覆盖被修改的两行，不包含没被碰到的 "}"。
    expect(result.selectionEnd).toBe(result.value.indexOf("\n}"));
  });

  it("outdents a caret by removing all leading spaces up to one indent width", () => {
    const result = computeTabIndent({
      value: "        int a;",
      selectionStart: 8,
      selectionEnd: 8,
      outdent: true,
    });

    expect(result.value).toBe("    int a;");
    expect(result.selectionStart).toBe(4);
    // 反缩进需要删除光标前的字符，无法用"替换选区"表达。
    expect(result.replacement).toBeNull();
  });

  it("removes all leading spaces before the caret but stops at the line start", () => {
    // 光标在第二个空格之后：两个空格都属于行首缩进，一起移除。
    const result = computeTabIndent({
      value: "int a;\n  int b;",
      selectionStart: 9,
      selectionEnd: 9,
      outdent: true,
    });

    expect(result.value).toBe("int a;\nint b;");
    expect(result.selectionStart).toBe(7);
  });

  it("only removes the indentation actually in front of the caret", () => {
    const result = computeTabIndent({
      value: "int a;\n  int b;",
      selectionStart: 8,
      selectionEnd: 8,
      outdent: true,
    });

    expect(result.value).toBe("int a;\n int b;");
    expect(result.selectionStart).toBe(7);
  });

  it("outdents a whole selected block again and again", () => {
    const first = computeTabIndent({
      value: "        a\n        b",
      selectionStart: 0,
      selectionEnd: 17,
      outdent: true,
    });
    expect(first.value).toBe("    a\n    b");

    const second = computeTabIndent({
      value: first.value,
      selectionStart: 0,
      selectionEnd: first.value.length,
      outdent: true,
    });
    expect(second.value).toBe("a\nb");

    const third = computeTabIndent({
      value: second.value,
      selectionStart: 0,
      selectionEnd: second.value.length,
      outdent: true,
    });
    expect(third.value).toBe("a\nb");
    expect(third.replacement).toBeNull();
  });

  it("removes a leading tab as one indent step", () => {
    const result = computeTabIndent({
      value: "\tint a;",
      selectionStart: 1,
      selectionEnd: 1,
      outdent: true,
    });

    expect(result.value).toBe("int a;");
  });

  it("leaves the value untouched when there is nothing to outdent", () => {
    const result = computeTabIndent({ value: "int a;", selectionStart: 0, selectionEnd: 0, outdent: true });

    expect(result.value).toBe("int a;");
    expect(result.selectionStart).toBe(0);
  });

  it("rejects a selection outside the value", () => {
    expect(() => computeTabIndent({ value: "ab", selectionStart: 3, selectionEnd: 3 })).toThrow(RangeError);
    expect(() => computeTabIndent({ value: "ab", selectionStart: 1, selectionEnd: 0 })).toThrow(RangeError);
    expect(() => computeTabIndent({ value: "ab", selectionStart: -1, selectionEnd: 1 })).toThrow(RangeError);
  });
});
