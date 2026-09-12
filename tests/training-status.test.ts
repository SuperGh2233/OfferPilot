import { describe, expect, it } from "vitest";

import { getTrainingStatusPresentation } from "../lib/ui/training-status";

describe("training status presentation", () => {
  it.each([
    ["mastered", "已掌握", "emerald"],
    ["due", "待复习", "amber"],
    ["weak", "薄弱", "rose"],
    ["unlearned", "未学习", "muted"],
  ] as const)("maps %s to the stable semantic style", (status, label, color) => {
    const presentation = getTrainingStatusPresentation(status);
    expect(presentation.label).toBe(label);
    expect(presentation.className).toContain(color);
  });
});
