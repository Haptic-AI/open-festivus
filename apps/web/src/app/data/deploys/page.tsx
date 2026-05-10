import type { Metadata } from "next"
import Link from "next/link"
import type { IDeployNote } from "@festivus/types"
import { SiteHeader } from "@/components/site-header"
import { FestivusClient } from "@/lib/api/festivus-client"

export const metadata: Metadata = {
  title: "Deploys | Festivus",
  description: "Every deploy note in the Festivus dataset — safety, compliance, and operational notes tied to robot types.",
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-annotation-red/10 text-annotation-red",
  warning: "bg-safety-yellow/20 text-blueprint-navy",
  info: "bg-blueprint-navy/10 text-blueprint-navy",
}

export default async function DeploysIndexPage() {
  const client = new FestivusClient()
  const raw = await client.searchDeployNotes({ limit: 500 })
  const notes: IDeployNote[] = raw ?? []

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
            Deploys
          </h1>
          <p className="text-blueprint-navy/70 mt-3 max-w-3xl text-base leading-relaxed md:text-lg">
            {notes.length} records. Safety, compliance, and operational deploy notes. Flag missing or outdated guidance; every untagged risk is a gap.
          </p>
        </header>

        {notes.length === 0 ? (
          <div className="border-blueprint-navy/10 rounded-lg border bg-white p-10 text-center">
            <p className="text-blueprint-navy/70">No deploy notes in the dataset yet.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {notes.map((note) => (
              <li key={note.slug}>
                <Link
                  className="border-blueprint-navy/10 hover:border-blueprint-navy/40 block rounded-lg border bg-white p-5 transition-colors"
                  href={`/data/deploys/${note.slug}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 font-mono text-[13px] font-bold uppercase tracking-wider ${SEVERITY_COLOR[note.severity] ?? "bg-blueprint-navy/10 text-blueprint-navy"}`}>
                      {note.severity}
                    </span>
                    <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
                      {note.robot_type}
                    </span>
                  </div>
                  <p className="text-blueprint-navy text-sm font-bold leading-snug">{note.name}</p>
                  <p className="text-blueprint-navy/70 mt-2 line-clamp-2 text-xs leading-relaxed">{note.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
