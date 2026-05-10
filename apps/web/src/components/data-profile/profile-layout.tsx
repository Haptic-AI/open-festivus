import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SuggestEditChip, type RecordKind } from "@/components/suggest-edit/suggest-edit-chip"

interface IProfileLayoutProps {
  recordKind: RecordKind
  recordId: string
  recordName: string
  subtitle?: string
  imageUrl?: string | null
  /** Breadcrumb label, e.g. "Robots" for /data/robots */
  sectionLabel: string
  sectionHref: string
  children: React.ReactNode
}

export function ProfileLayout({
  recordKind,
  recordId,
  recordName,
  subtitle,
  imageUrl,
  sectionLabel,
  sectionHref,
  children,
}: IProfileLayoutProps) {
  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-6 py-8 sm:px-10">
        <nav className="text-blueprint-navy/50 mb-6 flex items-center gap-2 font-mono text-[13px] uppercase tracking-wider">
          <Link className="hover:text-blueprint-navy" href="/data">
            Data
          </Link>
          <span>/</span>
          <Link className="hover:text-blueprint-navy" href={sectionHref}>
            {sectionLabel}
          </Link>
          <span>/</span>
          <span className="text-blueprint-navy/80">{recordId}</span>
        </nav>

        <header className="border-blueprint-navy/10 mb-8 flex flex-col gap-6 border-b pb-8 md:flex-row md:items-start">
          {imageUrl !== undefined && imageUrl !== null && imageUrl.length > 0 ? (
            <div className="border-blueprint-navy/10 bg-white relative h-48 w-48 shrink-0 overflow-hidden rounded-lg border">
              {/* Use a plain img so remote image allowlisting is not a concern. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={recordName}
                className="h-full w-full object-contain p-2"
                src={imageUrl}
              />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="text-blueprint-navy/50 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
              {recordKind}
            </p>
            <h1 className="text-blueprint-navy mt-1 text-3xl font-bold leading-tight md:text-4xl">
              {recordName}
            </h1>
            {subtitle !== undefined ? (
              <p className="text-blueprint-navy/70 mt-2 text-sm md:text-base">{subtitle}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SuggestEditChip
                recordId={recordId}
                recordKind={recordKind}
                recordName={recordName}
                visibility="always"
              />
              <span className="text-blueprint-navy/40 font-mono text-[13px]">
                or hover any field below to flag it
              </span>
            </div>
          </div>
        </header>

        {children}
      </div>
    </main>
  )
}
