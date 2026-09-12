import { notFound } from "next/navigation";

import { AlgorithmTraining } from "@/components/algorithm/algorithm-training";
import {
  algorithmCatalog,
  getAlgorithmProblem,
  toAlgorithmPlannerProblem,
} from "@/lib/algorithm/catalog";
import { isBrowserDemoMode } from "@/lib/supabase/env";

export function generateStaticParams() {
  return algorithmCatalog.map((problem) => ({ id: problem.id }));
}

export default async function AlgorithmProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const problem = getAlgorithmProblem(id);

  if (!problem) notFound();

  return (
    <AlgorithmTraining
      demoMode={isBrowserDemoMode()}
      plannerProblems={algorithmCatalog.map(toAlgorithmPlannerProblem)}
      problem={problem}
    />
  );
}
