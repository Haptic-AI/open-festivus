import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { IDeployNote } from "@festivus/types"
import { AskAIButton } from "@/components/agent-chat/AskAIButton"
import { SiteHeader } from "@/components/site-header"
import { FestivusClient } from "@/lib/api/festivus-client"

export const dynamicParams = true

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-annotation-red/10 text-annotation-red",
  warning: "bg-safety-yellow/20 text-blueprint-navy",
  info: "bg-blueprint-navy/10 text-blueprint-navy",
}

interface IPageProps {
  params: Promise<{ slug: string }>
}

async function findDeploy(slug: string): Promise<IDeployNote | null> {
  const notes = await new FestivusClient().searchDeployNotes({ limit: 500 })
  return notes?.find((n) => n.slug === slug) ?? null
}

export async function generateMetadata({ params }: IPageProps): Promise<Metadata> {
  const { slug } = await params
  const note = await findDeploy(slug)
  if (note === null) return { title: "Not found | Festivus" }
  return {
    title: `${note.name} · deploy note | Festivus`,
    description: note.description.slice(0, 160),
  }
}

export default async function DeployProfilePage({ params }: IPageProps) {
  const { slug } = await params
  const note = await findDeploy(slug)
  if (note === null) notFound()

  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-4xl px-6 py-12 sm:px-10">
        <Link
          className="text-blueprint-navy/60 hover:text-blueprint-navy mb-6 inline-block font-mono text-xs font-bold uppercase tracking-wider"
          href="/data/deploys"
        >
          ← Back to Deploys
        </Link>

        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 font-mono text-[13px] font-bold uppercase tracking-wider ${SEVERITY_COLOR[note.severity] ?? "bg-blueprint-navy/10 text-blueprint-navy"}`}>
              {note.severity}
            </span>
            <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
              {note.robot_type}
            </span>
          </div>
          <h1 className="text-blueprint-navy text-2xl font-bold leading-tight md:text-3xl">{note.name}</h1>
        </header>

        <section className="border-blueprint-navy/10 rounded-lg border bg-white p-6">
          <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
            Description
          </h2>
          <p className="text-blueprint-navy/80 text-sm leading-relaxed">{note.description}</p>
        </section>
      </div>

      <AskAIButton recordName={note.name} slug={note.slug} table="deploy_notes" />
    </main>
  )
}
