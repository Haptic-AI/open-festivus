import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ALL_POLICIES } from "@/data/seed"
import { POLICY_DETAILS } from "@/data/policy-details"
import { EVALUATION_CONFIGS } from "@/data/evaluation-configs"
import { BenchmarksSection } from "./benchmarks-section"
import { EvidenceViewer } from "./evidence-viewer"
import { RobotSelectionProvider } from "./robot-selection"
import { SandboxCta } from "./sandbox-cta"

const SKILL_LABELS: Record<string, string> = {
  manipulation: "Manipulation",
  locomotion: "Locomotion",
  navigation: "Navigation",
  aerial: "Aerial",
  other: "Other",
}

const EVIDENCE_LABELS: Record<string, string> = {
  verified: "Verified on real hardware",
  "sim-tested": "Tested in simulation",
  "model-card-only": "Model card only",
}

const EVIDENCE_COLORS: Record<string, string> = {
  verified: "bg-safety-yellow text-blueprint-navy",
  "sim-tested": "bg-blueprint-navy text-drafting-cream",
  "model-card-only": "bg-cold-gray/30 text-blueprint-navy/80",
}

function formatDownloads(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

function trendArrow(trend: number[]): string {
  if (trend.length < 2) return ""
  const first = trend[0]!
  const last = trend[trend.length - 1]!
  if (last > first * 1.05) return "↑"
  if (last < first * 0.95) return "↓"
  return "→"
}

function trendColor(trend: number[]): string {
  if (trend.length < 2) return "text-blueprint-navy/70"
  const first = trend[0]!
  const last = trend[trend.length - 1]!
  if (last > first * 1.05) return "text-green-600"
  if (last < first * 0.95) return "text-annotation-red"
  return "text-blueprint-navy/70"
}

export function generateStaticParams() {
  return ALL_POLICIES.map((p) => ({ slug: p.slug }))
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
    title: `${policy.name} | Festivus`,
    description: policy.taskDescription,
    alternates: {
      canonical: `https://festivus.hapticlabs.ai/data/policies/${slug}`,
    },
    openGraph: {
      title: `${policy.name} | Festivus`,
      description: policy.taskDescription,
      type: "website",
      images: ["/opengraph-image"],
    },
  }
}

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const policy = ALL_POLICIES.find((p) => p.slug === slug)
  if (policy === undefined) return notFound()

  const detail = POLICY_DETAILS[slug]
  const evalConfig = EVALUATION_CONFIGS[slug]

  return (
    <main className="bg-drafting-cream min-h-screen">
      {/* Header nav */}
      <div className="border-blueprint-navy/10 border-b px-6 py-4 sm:px-10">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <Link
            className="text-blueprint-navy text-xs font-bold uppercase tracking-[0.2em] transition-opacity hover:opacity-60"
            href="/"
          >
            Festivus
          </Link>
          <span className="text-blueprint-navy/20">/</span>
          <Link
            className="text-blueprint-navy/60 text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-60"
            href="/policies"
          >
            Policies
          </Link>
          <span className="text-blueprint-navy/20">/</span>
          <span className="text-blueprint-navy/70 text-xs">{policy.name}</span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-10">
        {/* Policy header */}
        <div className="mb-10">
          {/* Badges — all clickable */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${EVIDENCE_COLORS[policy.evidence.level] ?? ""}`}>
              {EVIDENCE_LABELS[policy.evidence.level] ?? policy.evidence.level}
            </span>
            <Link
              className="border-blueprint-navy/20 text-blueprint-navy/70 hover:border-blueprint-navy hover:text-blueprint-navy border px-2 py-0.5 text-xs uppercase tracking-wider transition-colors"
              href={`/policies?task=${policy.skillType}`}
            >
              {SKILL_LABELS[policy.skillType] ?? policy.skillType}
            </Link>
            <Link
              className="border-blueprint-navy/20 text-blueprint-navy/70 hover:border-blueprint-navy hover:text-blueprint-navy border px-2 py-0.5 text-xs uppercase tracking-wider transition-colors"
              href={`/policies?license=${policy.license}`}
            >
              {policy.license}
            </Link>
          </div>

          {/* Title */}
          <h1 className="text-blueprint-navy mb-2 text-2xl font-bold tracking-tight md:text-4xl">
            {policy.name}
          </h1>
          <p className="text-blueprint-navy/70 mb-4 text-base leading-relaxed md:text-lg">
            {policy.taskDescription}
          </p>

          {/* Slim meta line */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-blueprint-navy/70">
              by <span className="text-blueprint-navy font-bold">{policy.author}</span>
            </span>
            {policy.downloads !== undefined ? (
              <span className="text-blueprint-navy/70 flex items-center gap-1.5">
                <span className={`text-sm ${trendColor(policy.downloads.trend)}`}>
                  {trendArrow(policy.downloads.trend)}
                </span>
                <span className="text-blueprint-navy font-bold">{formatDownloads(policy.downloads.lastMonth)}</span>
                downloads/month
              </span>
            ) : null}
            {policy.hfRepoId !== undefined ? (
              <a
                className="text-blueprint-navy/70 hover:text-blueprint-navy underline underline-offset-2 transition-colors"
                href={`https://huggingface.co/${policy.hfRepoId}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                View on HF Hub →
              </a>
            ) : null}
          </div>
        </div>

        {/* About — authors, paper, links */}
        <section className="mb-6">
          <details className="group">
            <summary className="border-blueprint-navy/10 cursor-pointer list-none border p-6 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center justify-between">
                <h2 className="text-blueprint-navy text-xl font-bold uppercase tracking-tight md:text-2xl">
                  About
                </h2>
                <svg
                  className="text-blueprint-navy/60 h-5 w-5 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </div>
            </summary>
            <div className="border-blueprint-navy/10 border-x border-b p-6">
              {/* Authors */}
              {policy.paper?.authors !== undefined && policy.paper.authors.length > 0 ? (
                <div className="mb-6">
                  <p className="text-blueprint-navy/70 mb-3 text-xs font-bold uppercase tracking-wider">Authors</p>
                  <div className="flex flex-wrap items-center gap-3">
                    {policy.paper.authors.map((author) => {
                      const profileUrl = author.hfUrl ?? author.githubUrl
                      const initial = author.name.charAt(0)
                      return (
                        <div className="flex items-center gap-1.5" key={author.name}>
                          {author.avatarUrl !== undefined ? (
                            <Image
                              unoptimized
                              alt={author.name}
                              className="rounded-full"
                              height={24}
                              src={author.avatarUrl}
                              width={24}
                            />
                          ) : (
                            <div className="bg-blueprint-navy/10 text-blueprint-navy flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-bold">
                              {initial}
                            </div>
                          )}
                          {profileUrl !== undefined ? (
                            <a
                              className="text-blueprint-navy hover:text-blueprint-navy/70 text-xs font-medium transition-colors"
                              href={profileUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              {author.name}
                            </a>
                          ) : (
                            <span className="text-blueprint-navy/70 text-xs">{author.name}</span>
                          )}
                          {author.affiliation !== undefined ? (
                            <span className="text-blueprint-navy/70 text-[13px]">({author.affiliation})</span>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {/* Paper */}
              {policy.paper !== undefined ? (
                <div className="mb-6">
                  <p className="text-blueprint-navy/70 mb-3 text-xs font-bold uppercase tracking-wider">Paper</p>
                  <a
                    className="border-blueprint-navy/20 hover:border-blueprint-navy group block border p-4 transition-colors"
                    href={policy.paper.arxivUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="bg-annotation-red text-white px-2 py-0.5 text-[13px] font-bold uppercase tracking-wider">
                        arxiv
                      </span>
                      <span className="text-blueprint-navy/70 text-[13px] uppercase tracking-wider">
                        {policy.paper.publishedDate}
                      </span>
                    </div>
                    <p className="text-blueprint-navy group-hover:text-blueprint-navy/80 text-sm font-bold leading-snug transition-colors">
                      {policy.paper.title}
                    </p>
                    <p className="text-blueprint-navy/70 mt-1 text-xs">
                      {policy.paper.citations} citations · Read paper →
                    </p>
                  </a>
                </div>
              ) : null}

              {/* Links */}
              <div>
                <p className="text-blueprint-navy/70 mb-3 text-xs font-bold uppercase tracking-wider">Links</p>
                <div className="flex flex-wrap gap-3">
                  {policy.hfRepoId !== undefined ? (
                    <a
                      className="bg-blueprint-navy text-drafting-cream hover:bg-blueprint-navy/80 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
                      href={`https://huggingface.co/${policy.hfRepoId}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      HF Hub →
                    </a>
                  ) : null}
                  {policy.paper !== undefined ? (
                    <a
                      className="border-blueprint-navy/20 text-blueprint-navy hover:border-blueprint-navy inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
                      href={policy.paper.arxivUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      arxiv →
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </details>
        </section>

        {/* Interactive sections — share robot selection state via URL params */}
        <Suspense fallback={null}>
          <RobotSelectionProvider>
            {/* Hardware Compatibility + Video Previews */}
            {detail !== undefined ? (
              <EvidenceViewer compatibility={detail.compatibility} verifiedBy={detail.verifiedBy} />
            ) : (
              <section className="mb-6">
                <div className="border-blueprint-navy/10 border-2 border-dashed px-6 py-10 text-center">
                  <p className="text-blueprint-navy/60 mb-1 text-sm font-bold">
                    No compatibility data yet
                  </p>
                  <p className="text-blueprint-navy/70 text-xs">
                    This policy has not been tested on specific hardware.
                    Check back later or contribute your own results.
                  </p>
                </div>
              </section>
            )}

            {/* Sandbox CTA — forwards robot selection */}
            {evalConfig !== undefined ? (
              <SandboxCta slug={slug} />
            ) : null}

        {/* Technical Details */}
        <section className="mb-6">
          <details className="group">
            <summary className="border-blueprint-navy/10 cursor-pointer list-none border p-6 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center justify-between">
                <h2 className="text-blueprint-navy text-xl font-bold uppercase tracking-tight md:text-2xl">
                  Technical Details
                </h2>
                <svg
                  className="text-blueprint-navy/60 h-5 w-5 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </div>
            </summary>
            <div className="border-blueprint-navy/10 border-x border-b p-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-blueprint-navy/70 mb-1 text-xs font-bold uppercase tracking-wider">Action Space</p>
                  <p className="text-blueprint-navy text-sm">
                    {policy.actionSpace.type} ({policy.actionSpace.dimensions}D @ {policy.actionSpace.controlFrequencyHz}Hz)
                  </p>
                  {policy.actionSpace.description !== undefined ? (
                    <p className="text-blueprint-navy/70 mt-1 text-xs">{policy.actionSpace.description}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-blueprint-navy/70 mb-1 text-xs font-bold uppercase tracking-wider">Observation Space</p>
                  <p className="text-blueprint-navy text-sm">{policy.observationSpace.type}</p>
                  <div className="mt-1 space-y-0.5">
                    {policy.observationSpace.components.map((c) => (
                      <p className="text-blueprint-navy/70 text-xs" key={c.name}>
                        {c.name}: {c.type}{c.shape !== undefined ? ` [${c.shape.join("x")}]` : ""}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-blueprint-navy/70 mb-1 text-xs font-bold uppercase tracking-wider">Framework</p>
                  <p className="text-blueprint-navy text-sm">{policy.framework}</p>
                </div>
                {policy.simulationConfig !== undefined ? (
                  <div>
                    <p className="text-blueprint-navy/70 mb-1 text-xs font-bold uppercase tracking-wider">Training Environment</p>
                    <p className="text-blueprint-navy text-sm">
                      {policy.simulationConfig.environment}
                      {policy.simulationConfig.environmentVersion !== undefined
                        ? ` ${policy.simulationConfig.environmentVersion}`
                        : ""}
                    </p>
                    {policy.simulationConfig.scene !== undefined ? (
                      <p className="text-blueprint-navy/70 mt-1 text-xs">Scene: {policy.simulationConfig.scene}</p>
                    ) : null}
                  </div>
                ) : null}
                {/* Training Dataset */}
                {policy.trainingDataset !== undefined ? (
                  <div className="sm:col-span-2">
                    <p className="text-blueprint-navy/70 mb-1 text-xs font-bold uppercase tracking-wider">Training Dataset</p>
                    <p className="text-blueprint-navy text-sm font-bold">{policy.trainingDataset.name}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs">
                      <span className="text-blueprint-navy/70">
                        {policy.trainingDataset.episodes.toLocaleString()} episodes
                      </span>
                      <span className="text-blueprint-navy/70">
                        {policy.trainingDataset.robots} robot{policy.trainingDataset.robots > 1 ? "s" : ""}
                      </span>
                      <span className="text-blueprint-navy/70">
                        {policy.trainingDataset.source}
                      </span>
                      {policy.trainingDataset.hfDatasetId !== undefined ? (
                        <a
                          className="text-blueprint-navy hover:text-blueprint-navy/70 underline underline-offset-2"
                          href={`https://huggingface.co/datasets/${policy.trainingDataset.hfDatasetId}`}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          View dataset on HF →
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div>
                  <p className="text-blueprint-navy/70 mb-1 text-xs font-bold uppercase tracking-wider">Compatible Hardware</p>
                  <div className="flex flex-wrap gap-1">
                    {policy.hardware.map((h) => (
                      <Link
                        className="bg-blueprint-navy/5 text-blueprint-navy/70 hover:bg-blueprint-navy/10 hover:text-blueprint-navy px-2 py-0.5 text-xs transition-colors"
                        href={`/policies?robot=${h.name}`}
                        key={h.id}
                      >
                        {h.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </details>
        </section>

            {/* Benchmarks — robot-aware */}
            <BenchmarksSection benchmarks={policy.benchmarks} robotBenchmarks={detail?.robotBenchmarks} />
          </RobotSelectionProvider>
        </Suspense>
      </div>
    </main>
  )
}
