import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ALL_POLICIES } from "@/data/seed"
import { EVALUATION_CONFIGS } from "@/data/evaluation-configs"
import { PolicyEvaluator } from "../policy-evaluator"

export function generateStaticParams() {
  return Object.keys(EVALUATION_CONFIGS).map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const policy = ALL_POLICIES.find((p) => p.slug === slug)
  if (policy === undefined) return { title: "Not Found | Festivus" }
  return {
    title: `Evaluate ${policy.name} | Festivus`,
    description: `Test ${policy.name} against different robots and environments.`,
  }
}

export default async function EvaluatePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const policy = ALL_POLICIES.find((p) => p.slug === slug)
  const evalConfig = EVALUATION_CONFIGS[slug]
  if (policy === undefined || evalConfig === undefined) return notFound()

  return (
    <div className="bg-drafting-cream flex h-screen flex-col">
      {/* Minimal top bar */}
      <div className="border-blueprint-navy/10 flex shrink-0 items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            className="text-blueprint-navy text-xs font-bold uppercase tracking-[0.2em] transition-opacity hover:opacity-60"
            href={`/policies/${slug}`}
          >
            ← {policy.name}
          </Link>
        </div>
        <p className="text-blueprint-navy/60 text-[13px] font-bold uppercase tracking-widest">
          Sandbox
        </p>
      </div>

      {/* Full viewport evaluator */}
      <div className="flex-1 overflow-hidden">
        <PolicyEvaluator config={evalConfig} policy={policy} />
      </div>
    </div>
  )
}
