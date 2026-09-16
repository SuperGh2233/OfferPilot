import { redirect } from "next/navigation";

import AlgorithmList from "@/components/algorithm/algorithm-list";
import {
  algorithmCatalog,
  algorithmTags,
} from "@/lib/algorithm/catalog";
import { isBrowserDemoMode, isLocalDemoMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function AlgorithmPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const localMode = isLocalDemoMode();
  const demoMode = isBrowserDemoMode();
  const requestedFilter = (await searchParams).filter;
  const initialFilter = requestedFilter === "due" || requestedFilter === "unlearned"
    ? requestedFilter
    : "all";

  if (!localMode) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    if (!data?.claims) {
      redirect("/login");
    }
  }

  return (
    <AlgorithmList
      demoMode={demoMode}
      initialFilter={initialFilter}
      key={initialFilter}
      problems={algorithmCatalog}
      tags={algorithmTags}
    />
  );
}
