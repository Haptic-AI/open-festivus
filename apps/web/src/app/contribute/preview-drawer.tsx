import Link from "next/link"
import type { ITask, TaskArea } from "./fetch-tasks-types"

// Keep this file independent of tasks-view.tsx so it can be imported
// from flow-view / search-view / browse alike without circular deps.

const AREA_STYLES: Record<
  TaskArea,
  { name: string; bg: string; text: string; border: string }
> = {
  robots:      { name: "Robots",      bg: "bg-[#1d76db]/10", text: "text-[#1d76db]", border: "border-[#1d76db]/40" },
  policies:    { name: "Policies",    bg: "bg-[#5319e7]/10", text: "text-[#5319e7]", border: "border-[#5319e7]/40" },
  simulations: { name: "Simulations", bg: "bg-[#0e8a16]/10", text: "text-[#0e8a16]", border: "border-[#0e8a16]/40" },
  datasets:    { name: "Datasets",    bg: "bg-[#d93f0b]/10", text: "text-[#d93f0b]", border: "border-[#d93f0b]/40" },
  papers:      { name: "Papers",      bg: "bg-[#f9a826]/10", text: "text-[#a87408]", border: "border-[#f9a826]/40" },
  platform:    { name: "Platform",    bg: "bg-black/5",      text: "text-black/70",  border: "border-black/20" },
}

function AreaBadge({ area }: { area: TaskArea | null }) {
  if (area === null) {
    return (
      <span className="border-blueprint-navy/20 text-blueprint-navy/60 rounded border px-2 py-0.5 text-[14px] font-bold uppercase tracking-wider">
        unlabeled
      </span>
    )
  }
  const s = AREA_STYLES[area]
  return (
    <span
      className={`${s.bg} ${s.text} ${s.border} rounded border px-2 py-0.5 text-[14px] font-bold uppercase tracking-wider`}
    >
      {s.name}
    </span>
  )
}

function Chip({ label }: { label: string }) {
  return (
    <span className="border-blueprint-navy/15 text-blueprint-navy/70 rounded border px-2 py-0.5 text-[14px]">
      {label}
    </span>
  )
}

function renderBody(body: string): React.ReactNode {
  // Very light markdown: paragraphs separated by blank lines; bold via **text**.
  // Good enough for the templated bodies in the seed.
  const paragraphs = body.replace(/\r\n/g, "\n").split(/\n\n+/)
  return paragraphs.map((paragraph, idx) => {
    const parts: React.ReactNode[] = []
    let remaining = paragraph.trim()
    let counter = 0
    while (remaining.length > 0) {
      const match = remaining.match(/\*\*(.+?)\*\*/)
      if (match === null || match.index === undefined) {
        parts.push(remaining)
        break
      }
      if (match.index > 0) parts.push(remaining.slice(0, match.index))
      parts.push(
        <strong className="text-blueprint-navy font-semibold" key={`b-${idx}-${counter++}`}>
          {match[1]}
        </strong>,
      )
      remaining = remaining.slice(match.index + match[0].length)
    }
    return (
      <p className="text-blueprint-navy/80 mt-3 text-sm leading-relaxed first:mt-0" key={idx}>
        {parts}
      </p>
    )
  })
}

export function PreviewDrawer({
  task,
  closeHref,
}: {
  task: ITask
  closeHref: string
}) {
  const areaMeta = task.area !== null ? AREA_STYLES[task.area] : null

  return (
    <>
      {/* Backdrop click-out */}
      <Link
        aria-label="Close preview"
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        href={closeHref}
        scroll={false}
      />

      <aside
        aria-label="Task preview"
        className="bg-drafting-cream border-blueprint-navy/10 fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l shadow-xl"
      >
        <div className="border-blueprint-navy/10 flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <AreaBadge area={task.area} />
            <span className="text-blueprint-navy/40 font-mono text-[14px] tabular-nums">
              #{task.number}
            </span>
          </div>
          <Link
            aria-label="Close"
            className="text-blueprint-navy/50 hover:text-blueprint-navy rounded p-1 text-xl leading-none transition-colors"
            href={closeHref}
            scroll={false}
          >
            ×
          </Link>
        </div>

        <div className="px-5 py-6">
          <h2 className="text-blueprint-navy text-xl font-bold leading-snug tracking-tight">
            {task.title.replace(/^\[task\]\s*/, "")}
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {task.kind !== null ? <Chip label={`kind: ${task.kind}`} /> : null}
            {task.needs !== null ? <Chip label={`needs: ${task.needs}`} /> : null}
            {task.difficulty !== null ? <Chip label={task.difficulty} /> : null}
            {task.assignees.length > 0 ? (
              <Chip label={`@${task.assignees.join(" @")}`} />
            ) : (
              <Chip label="unassigned" />
            )}
          </div>

          {task.instructions ? (
            <p className="text-blueprint-navy/80 mt-6 text-sm leading-relaxed">
              {task.instructions}
            </p>
          ) : (
            <div className="mt-6">{renderBody(task.body)}</div>
          )}

          {task.record_url ? (
            <div className="bg-blueprint-navy/5 border-blueprint-navy/10 mt-6 rounded border p-3">
              <p className="text-blueprint-navy/60 font-mono text-[11px] font-bold uppercase tracking-wider">
                Record
              </p>
              <p className="text-blueprint-navy mt-1 text-sm">
                {task.record_label ?? task.record_url}
              </p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            {task.record_url ? (
              <Link
                className="bg-blueprint-navy text-drafting-cream rounded px-4 py-2 text-sm font-semibold hover:opacity-90"
                href={task.record_url}
              >
                Open the record →
              </Link>
            ) : null}
            <Link
              className="border-blueprint-navy/20 text-blueprint-navy/70 rounded border px-4 py-2 text-sm hover:bg-white"
              href={closeHref}
              scroll={false}
            >
              Close
            </Link>
          </div>

          <div className="border-blueprint-navy/10 mt-8 rounded border bg-white/40 p-4">
            <p className="text-blueprint-navy/60 font-mono text-[11px] font-bold uppercase tracking-wider">
              How to take this task
            </p>
            <ol className="text-blueprint-navy/80 mt-2 space-y-1.5 text-sm leading-relaxed">
              <li>
                <span className="text-blueprint-navy/40 font-mono mr-2">1.</span>
                Click the button above to open the record this task is about.
              </li>
              <li>
                <span className="text-blueprint-navy/40 font-mono mr-2">2.</span>
                Find the field that needs work. Each field has a{" "}
                <span className="bg-safety-yellow/40 rounded px-1 font-mono text-xs">
                  suggest-edit
                </span>{" "}
                chip beside it.
              </li>
              <li>
                <span className="text-blueprint-navy/40 font-mono mr-2">3.</span>
                Type your fix. Submit. It&apos;s live in seconds. A moderator
                can revert if it&apos;s wrong.
              </li>
            </ol>
            {areaMeta !== null ? (
              <p className="text-blueprint-navy/50 mt-3 text-xs">
                This task lives in the <strong className="text-blueprint-navy/70">{areaMeta.name}</strong> area. Pick an area
                on the main page to scope the list.
              </p>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  )
}
