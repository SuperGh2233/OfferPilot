"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { knowledgeReturnHref } from "@/lib/knowledge/browser";

function ReturnLink({ className, children }: { className: string; children: ReactNode }) {
  const params = useSearchParams();
  return <Link className={className} href={knowledgeReturnHref(params.get("returnTo"))}>{children}</Link>;
}

export function KnowledgeCatalogReturnLink(props: { className: string; children: ReactNode }) {
  return <Suspense fallback={<Link className={props.className} href="/knowledge">{props.children}</Link>}><ReturnLink {...props} /></Suspense>;
}
