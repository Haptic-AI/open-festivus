import Link from "next/link"
import type { IRelatedItem } from "@/lib/data/lookups"

interface IRelatedListProps {
  title: string
  items: IRelatedItem[]
  emptyHint: string
}

export function RelatedList({ title, items, emptyHint }: IRelatedListProps) {
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-blueprint-navy/80 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
          {title}
        </h2>
        <span className="text-blueprint-navy/50 font-mono text-[13px] tabular-nums">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="border-blueprint-navy/10 bg-white rounded-lg border p-5">
          <p className="text-blueprint-navy/60 text-sm italic">{emptyHint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {items.map((item) => (
            <Link
              className="border-blueprint-navy/10 hover:border-blueprint-navy/30 bg-white group flex min-w-0 flex-col gap-0.5 rounded-lg border px-3 py-2 transition-colors"
              href={item.href}
              key={`${item.slug}-${item.href}`}
            >
              <span className="text-blueprint-navy truncate text-sm font-medium group-hover:underline">
                {item.name}
              </span>
              {item.subtitle !== undefined ? (
                <span className="text-blueprint-navy/60 truncate font-mono text-[13px]">
                  {item.subtitle}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
