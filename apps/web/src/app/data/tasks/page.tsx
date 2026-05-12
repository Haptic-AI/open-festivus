import type { Metadata } from "next"
import Link from "next/link"
import type { ITask } from "@festivus/types"
import { SiteHeader } from "@/components/site-header"
import { FestivusClient } from "@/lib/api/festivus-client"

export const metadata: Metadata = {
  title: "Tasks | Festivus",
  description: "Every task in the Festivus dataset — concrete robotics jobs that link questions to robots and policies.",
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-blueprint-navy/10 text-blueprint-navy",
  medium: "bg-safety-yellow/20 text-blueprint-navy",
  hard: "bg-annotation-red/10 text-annotation-red",
  unsolved: "bg-annotation-red/15 text-annotation-red",
}

export default async function TasksIndexPage() {
  const client = new FestivusClient()
  const raw = await client.searchTasks({ limit: 500 })
  const tasks: ITask[] = raw ?? []

  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
        <Link
          className="text-blueprint-navy/60 hover:text-blueprint-navy mb-6 inline-block font-mono text-xs font-bold uppercase tracking-wider"
          href="/data"
        >
          ← Back to Open Data
        </Link>

        <header className="mb-10">
          <h1 className="text-blueprint-navy text-3xl font-bold uppercase tracking-tight md:text-5xl">
            Tasks
          </h1>
          <p className="text-blueprint-navy/70 mt-3 max-w-3xl text-base leading-relaxed md:text-lg">
            {tasks.length} records. Concrete robotics jobs — what someone wants a robot to do. Each task links to compatible robots and policies.
          </p>
        </header>

        {tasks.length === 0 ? (
          <div className="border-blueprint-navy/10 rounded-lg border bg-white p-10 text-center">
            <p className="text-blueprint-navy/70">No tasks in the dataset yet. The schema is ready; rows have not been seeded.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <li key={task.slug}>
                <Link
                  className="border-blueprint-navy/10 hover:border-blueprint-navy/40 block rounded-lg border bg-white p-5 transition-colors"
                  href={`/data/tasks/${task.slug}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 font-mono text-[13px] font-bold uppercase tracking-wider ${DIFFICULTY_COLOR[task.difficulty] ?? "bg-blueprint-navy/10 text-blueprint-navy"}`}>
                      {task.difficulty}
                    </span>
                    <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
                      {task.category}
                    </span>
                  </div>
                  <p className="text-blueprint-navy text-sm font-bold leading-snug">{task.name}</p>
                  <p className="text-blueprint-navy/70 mt-2 line-clamp-2 text-xs leading-relaxed">{task.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
