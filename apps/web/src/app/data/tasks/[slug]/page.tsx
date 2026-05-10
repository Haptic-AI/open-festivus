import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { ITask } from "@festivus/types"
import { AskAIButton } from "@/components/agent-chat/AskAIButton"
import { SiteHeader } from "@/components/site-header"
import { FestivusClient } from "@/lib/api/festivus-client"

export const dynamicParams = true

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-blueprint-navy/10 text-blueprint-navy",
  medium: "bg-safety-yellow/20 text-blueprint-navy",
  hard: "bg-annotation-red/10 text-annotation-red",
  unsolved: "bg-annotation-red/15 text-annotation-red",
}

interface IPageProps {
  params: Promise<{ slug: string }>
}

async function findTask(slug: string): Promise<ITask | null> {
  return new FestivusClient().getTask(slug)
}

export async function generateMetadata({ params }: IPageProps): Promise<Metadata> {
  const { slug } = await params
  const task = await findTask(slug)
  if (task === null) return { title: "Not found | Festivus" }
  return {
    title: `${task.name} · task | Festivus`,
    description: task.description.slice(0, 160),
  }
}

export default async function TaskProfilePage({ params }: IPageProps) {
  const { slug } = await params
  const task = await findTask(slug)
  if (task === null) notFound()

  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-4xl px-6 py-12 sm:px-10">
        <Link
          className="text-blueprint-navy/60 hover:text-blueprint-navy mb-6 inline-block font-mono text-xs font-bold uppercase tracking-wider"
          href="/data/tasks"
        >
          ← Back to Tasks
        </Link>

        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 font-mono text-[13px] font-bold uppercase tracking-wider ${DIFFICULTY_COLOR[task.difficulty] ?? "bg-blueprint-navy/10 text-blueprint-navy"}`}>
              {task.difficulty}
            </span>
            <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
              {task.category}
            </span>
            {task.has_real_world_demo ? (
              <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
                · real-world demo
              </span>
            ) : null}
          </div>
          <h1 className="text-blueprint-navy text-2xl font-bold leading-tight md:text-3xl">{task.name}</h1>
        </header>

        <section className="border-blueprint-navy/10 mb-6 rounded-lg border bg-white p-6">
          <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">Description</h2>
          <p className="text-blueprint-navy/80 text-sm leading-relaxed">{task.description}</p>
        </section>

        {task.sub_tasks.length > 0 ? (
          <section className="border-blueprint-navy/10 mb-6 rounded-lg border bg-white p-6">
            <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">Sub-tasks</h2>
            <ul className="space-y-1">
              {task.sub_tasks.map((st) => (
                <li className="text-blueprint-navy/80 text-sm" key={st}>· {st}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {task.required_capabilities.length > 0 ? (
          <section className="border-blueprint-navy/10 mb-6 rounded-lg border bg-white p-6">
            <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">Required capabilities</h2>
            <ul className="flex flex-wrap gap-2">
              {task.required_capabilities.map((c) => (
                <li className="bg-blueprint-navy/5 text-blueprint-navy/80 rounded px-2 py-1 font-mono text-xs" key={c}>{c}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {task.compatible_policy_slugs.length > 0 ? (
          <section className="border-blueprint-navy/10 rounded-lg border bg-white p-6">
            <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">Compatible policies</h2>
            <ul className="space-y-1">
              {task.compatible_policy_slugs.map((slug) => (
                <li key={slug}>
                  <Link className="text-blueprint-navy hover:text-annotation-red text-sm underline decoration-dotted" href={`/data/policies/${slug}`}>
                    {slug}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <AskAIButton recordName={task.name} slug={task.slug} table="tasks" />
    </main>
  )
}
