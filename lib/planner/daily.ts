import {
  generateDailyAlgorithmTasks,
  type DailyAlgorithmTask,
  type GenerateDailyAlgorithmTasksInput,
} from "./algorithm";
import {
  generateDailyKnowledgeTasks,
  type DailyKnowledgeTask,
  type GenerateDailyKnowledgeTasksInput,
} from "./knowledge";

export function generateDailyTasks({
  algorithm,
  knowledge,
}: {
  algorithm: GenerateDailyAlgorithmTasksInput;
  knowledge: GenerateDailyKnowledgeTasksInput;
}): {
  algorithmTasks: DailyAlgorithmTask[];
  knowledgeTasks: DailyKnowledgeTask[];
} {
  return {
    algorithmTasks: generateDailyAlgorithmTasks(algorithm),
    knowledgeTasks: generateDailyKnowledgeTasks(knowledge),
  };
}
