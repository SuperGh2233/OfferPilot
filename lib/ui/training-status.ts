export type TrainingVisualStatus = "mastered" | "due" | "weak" | "unlearned" | "learning";

const presentations = {
  mastered: {
    label: "已掌握",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  due: {
    label: "待复习",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  },
  weak: {
    label: "薄弱",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  },
  unlearned: {
    label: "未学习",
    className: "bg-muted text-muted-foreground",
  },
  learning: {
    label: "巩固中",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  },
} as const;

export function getTrainingStatusPresentation(status: TrainingVisualStatus) {
  return presentations[status];
}
