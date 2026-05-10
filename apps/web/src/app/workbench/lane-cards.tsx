"use client"

/**
 * Lane card components — HardwareCard, PolicyCard, EnvironmentCard.
 *
 * Moved out of workbench-canvas.tsx in spec 029 phase 3.4.5.c to shrink
 * the monster file ahead of Step 3.5's confirmation-card surgery.
 * ZERO behavior change — straight extract.
 *
 * Each card renders one option inside an ExplorationLane (which stays
 * in workbench-canvas.tsx because it composes these three). Cards are
 * pure presentational: no parent-state closures, all data rides on
 * `opt: ILaneOption`.
 *
 * EnvironmentCard also owns the small `useMatchingSimulation` hook
 * (fetches the latest Simulation for an env_slug) since that's only
 * used by this card.
 */

import Link from "next/link"
import { useEffect, useState } from "react"
import { normalizeSuccessRate } from "@/lib/workbench/compatibility"
import { reliabilityTier } from "@/lib/schemas/domain"
import type { ILaneOption } from "./canvas-theme"
import { NodeImage } from "./canvas-nodes"

export function HardwareCard({ opt, onSelect, onRemove }: { opt: ILaneOption; onSelect: () => void; onRemove: () => void }) {
  const nd = opt.nodeData
  const t = opt.theme
  const price = typeof nd["price"] === "number" ? (nd["price"] as number) : typeof nd["price_usd"] === "number" ? (nd["price_usd"] as number) : undefined
  const dof = typeof nd["dof"] === "number" ? (nd["dof"] as number) : undefined
  const robotType = typeof nd["type"] === "string" ? (nd["type"] as string) : undefined
  const armType = nd["arm_type"] as string | undefined
  const formFactor = nd["form_factor"] as string | undefined
  const deployReadiness = nd["deploy_readiness"] as string | undefined
  const isIncompat = opt.compat !== undefined && opt.compat.score === 0
  const expanded = opt.expanded === true

  const manufacturer = nd["manufacturer"] as string | undefined
  const slug = typeof nd["slug"] === "string" ? (nd["slug"] as string) : undefined
  const description = typeof nd["description"] === "string" ? (nd["description"] as string) : undefined
  const payload = nd["payload_kg"] as number | undefined
  const reach = nd["reach_mm"] as number | undefined
  const servos = nd["servos"] as string | undefined
  const weight = nd["weight_kg"] as number | undefined
  const buildPaths = nd["build_paths"] as Array<Record<string, unknown>> | undefined
  const compatPolicies = nd["compatible_policy_slugs"] as string[] | undefined

  // Curated robots ship a manufacturer-authoritative product_page_url. Prefer it.
  // Bulk HF-scraped records lack it, so fall back to a huggingface.co/{slug} search.
  const productPageUrl = typeof nd["product_page_url"] === "string" ? (nd["product_page_url"] as string) : undefined
  const sourceUrl = productPageUrl ?? (slug !== undefined ? `https://huggingface.co/${encodeURIComponent(slug)}` : undefined)
  const sourceIsProductPage = productPageUrl !== undefined
  const typeLabel = armType ?? formFactor ?? robotType

  const deployStyle = deployReadiness === "lab_only" ? t.deployLabOnly : t.deployCeMarked

  // PM plan 2.1: stronger de-emphasis for score=0 cards.
  const incompatOpacityH = 0.3
  const resolvedOpacityH = opt.selected ? 1 : isIncompat ? incompatOpacityH : t.dimOpacity

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-lg shadow-md"
      onClick={onSelect}
      onMouseEnter={(e) => { if (!opt.selected) e.currentTarget.style.opacity = `${isIncompat ? 0.5 : t.dimHoverOpacity}` }}
      onMouseLeave={(e) => { if (!opt.selected) e.currentTarget.style.opacity = `${resolvedOpacityH}` }}
      style={{
        backgroundColor: t.cardBg,
        opacity: resolvedOpacityH,
        filter: isIncompat && !opt.selected ? "grayscale(0.6)" : "none",
        borderTop: opt.selected ? `3px solid ${t.selectedBorder}` : `2px solid ${t.cardBorder}`,
        borderRight: `2px solid ${t.cardBorder}`,
        borderBottom: `2px solid ${t.cardBorder}`,
        borderLeft: opt.compat !== undefined && !opt.selected ? `3px solid ${opt.compat.color}` : `2px solid ${t.cardBorder}`,
        transition: "width 200ms ease-out, border-color 300ms, opacity 300ms, background-color 300ms, filter 300ms",
      }}
    >
      {/* Compat badge — visual only so whole card is one hitbox (PM 2.4) */}
      {opt.compat !== undefined ? (
        <div
          className="absolute -top-2 -right-2 z-10 rounded font-bold text-white"
          style={{ backgroundColor: opt.compat.color, fontSize: 12, padding: "2px 8px", pointerEvents: "none" }}
        >
          {opt.compat.label}
        </div>
      ) : null}
      {/* Collapse button when expanded */}
      {expanded ? (
        <button
          className="absolute top-2 right-2 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full"
          onClick={(e) => { e.stopPropagation(); onSelect() }}
          style={{ backgroundColor: `${t.cardBg}cc`, color: t.cardTextSecondary }}
          type="button"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
      {/* Image thumbnail */}
      {opt.imageUrl !== undefined ? (
        <div className="flex items-center justify-center overflow-hidden rounded-t-lg" style={{ height: 100, backgroundColor: t.tagBg }}>
          <NodeImage alt={opt.name} height={100} src={opt.imageUrl} />
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-t-lg font-bold" style={{ height: 100, backgroundColor: t.tagBg, color: t.cardTextSecondary, fontSize: 24 }}>
          {opt.name.charAt(0)}
        </div>
      )}
      <div style={{ padding: "8px 10px 10px" }}>
        {/* Name */}
        <p style={{ fontSize: 16, fontWeight: 500, color: t.cardText }}>{opt.name}</p>
        {/* Manufacturer — always shown when present */}
        {manufacturer !== undefined ? (
          <p className="text-[14px]" style={{ color: t.cardTextSecondary }}>{manufacturer}</p>
        ) : null}
        {/* Description snippet — only when collapsed, truncated */}
        {!expanded && description !== undefined && description.length > 0 ? (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug" style={{ color: t.cardTextSecondary }}>{description}</p>
        ) : null}
        {/* Price */}
        {price !== undefined ? (
          <p className="mt-1" style={{ fontSize: 24, fontWeight: 500, color: t.cardText }}>${price.toLocaleString()}</p>
        ) : null}
        {/* Meta tags */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {dof !== undefined ? (
            <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: t.tagBg, color: t.tagText }}>
              {dof}-DoF
            </span>
          ) : null}
          {typeLabel !== undefined ? (
            <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: t.tagBg, color: t.tagText }}>
              {typeLabel}
            </span>
          ) : null}
          {slug !== undefined ? (
            <Link
              className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
              href={`/data/robots/${slug}`}
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: t.tagBg, color: t.cardText }}
              title="Open the full data profile for this robot"
            >
              profile
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          ) : null}
          {sourceUrl !== undefined ? (
            <a
              className={`${slug !== undefined ? "" : "ml-auto"} inline-flex items-center gap-0.5 text-[13px] font-medium underline decoration-dotted`}
              href={sourceUrl}
              onClick={(e) => e.stopPropagation()}
              rel="noopener noreferrer"
              style={{ color: t.cardTextSecondary }}
              target="_blank"
              title={sourceIsProductPage ? "Open manufacturer product page" : "Open source on Hugging Face"}
            >
              source
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
          ) : null}
        </div>
        {/* Deploy badge */}
        {deployReadiness !== undefined ? (
          <div className="mt-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[13px] font-bold"
              style={{ backgroundColor: deployStyle.bg, color: deployStyle.text }}
            >
              {deployReadiness === "lab_only" ? "Lab only" : deployReadiness === "ce_marked" ? "CE marked" : deployReadiness}
            </span>
          </div>
        ) : null}
        {/* Expanded detail content */}
        {expanded ? (
          <div className="mt-3 border-t pt-3" style={{ borderColor: t.cardBorder }}>
            <div className="divide-y rounded-lg border" style={{ borderColor: t.cardBorder }}>
              {([
                ["DOF", dof !== undefined ? `${dof}` : undefined],
                ["Payload", payload !== undefined ? `${payload} kg` : undefined],
                ["Reach", reach !== undefined ? `${reach} mm` : undefined],
                ["Servos", servos],
                ["Weight", weight !== undefined ? `${weight} kg` : undefined],
                ["Deploy readiness", deployReadiness],
              ] as Array<[string, string | undefined]>).filter(([, v]) => v !== undefined).map(([label, value]) => (
                <div className="flex items-center justify-between px-3 py-1.5" key={label} style={{ borderColor: t.cardBorder }}>
                  <span className="text-[13px]" style={{ color: t.cardTextSecondary }}>{label}</span>
                  <span className="text-[14px] font-medium" style={{ color: t.cardText }}>{value}</span>
                </div>
              ))}
            </div>
            {buildPaths !== undefined && buildPaths.length > 0 ? (
              <div className="mt-3">
                <p className="mb-1.5 text-[13px] font-bold uppercase tracking-wider" style={{ color: t.cardText }}>Build Paths</p>
                <div className="space-y-1">
                  {buildPaths.map((bp, i) => (
                    <div className="flex items-center justify-between rounded border px-2.5 py-1.5" key={i} style={{ borderColor: t.cardBorder }}>
                      <span className="text-[14px] font-medium" style={{ color: t.cardText }}>{(bp["method"] as string | undefined) ?? "Option"}</span>
                      {(bp["cost"] as number | undefined) !== undefined ? (
                        <span className="text-[14px]" style={{ color: t.cardTextSecondary }}>${(bp["cost"] as number).toLocaleString()}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {compatPolicies !== undefined && compatPolicies.length > 0 ? (
              <div className="mt-3">
                <p className="mb-1.5 text-[13px] font-bold uppercase tracking-wider" style={{ color: t.cardText }}>Compatible Policies</p>
                <div className="flex flex-wrap gap-1">
                  {compatPolicies.map((slug) => (
                    <span className="rounded-full px-2 py-0.5 text-[13px] font-medium" key={slug} style={{ backgroundColor: t.tagBg, color: t.linkColor }}>
                      {slug}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {/* X button (hidden when expanded) */}
      {!expanded ? (
        <button
          className="bg-blueprint-navy/5 text-blueprint-navy/70 hover:bg-blueprint-navy/10 absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          style={{ display: opt.compat !== undefined ? "none" : undefined }}
          type="button"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

export function PolicyCard({ opt, onSelect, onRemove }: { opt: ILaneOption; onSelect: () => void; onRemove: () => void }) {
  const nd = opt.nodeData
  const t = opt.theme
  const slug = nd["slug"] as string | undefined
  const selectedRobotSlug = opt.selectedRobotSlug
  // Live fetch of the compat edge from /v1/compatibility whenever we know
  // both the policy slug and the currently-selected robot. Self-contained:
  // the card doesn't depend on the agent having written success_rate into
  // the node (agents can be mid-turn, stale, or reading an empty edges
  // table at the time the node was created). Tier 3/4 edges intentionally
  // do not surface a number — honest "no score" beats misleading.
  const [liveEdge, setLiveEdge] = useState<{ success_rate: number | null; reliability_tier: number | null | undefined } | null>(null)
  useEffect(() => {
    if (slug === undefined || selectedRobotSlug === undefined) { setLiveEdge(null); return }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/compat?robot=${encodeURIComponent(selectedRobotSlug)}&policy=${encodeURIComponent(slug)}`)
        if (!res.ok) return
        const body = (await res.json()) as { results?: Array<{ policy_slug?: string; source: string; status: string; success_rate: number | null; reliability_tier?: number | null }> }
        // The dataset api filters permissively — it returns every edge
        // matching robot, regardless of the policy filter — so match
        // exactly here. If multiple edges exist for the pair (distinct
        // environments), take the first.
        const match = (body.results ?? []).find((e) => e.policy_slug === slug)
        if (!cancelled && match !== undefined) {
          // Api doesn't inject reliability_tier yet, so derive it from
          // source + status using the same helper every other consumer uses.
          const tier = match.reliability_tier ?? reliabilityTier({ source: match.source, status: match.status })
          setLiveEdge({ success_rate: match.success_rate, reliability_tier: tier })
        }
      } catch { /* leave as null; card falls back to nodeData */ }
    })()
    return () => { cancelled = true }
  }, [slug, selectedRobotSlug])

  const srRaw = (liveEdge?.success_rate ?? nd["success_rate"]) as number | null | undefined
  const sr = srRaw !== undefined && srRaw !== null ? normalizeSuccessRate(srRaw) : undefined
  const tierRaw = liveEdge?.reliability_tier ?? (nd["reliability_tier"] as number | undefined)
  const showScore = sr !== undefined && (tierRaw === 1 || tierRaw === 2)
  const tier2 = tierRaw === 2
  const author = (nd["author"] as string | undefined) ?? (nd["framework"] as string | undefined)
  const architecture = nd["architecture"] as string | undefined
  const framework = nd["framework"] as string | undefined
  const hfRepoId = nd["hf_repo_id"] as string | undefined
  const isIncompat = opt.compat !== undefined && opt.compat.score === 0
  const expanded = opt.expanded === true

  const trainingData = nd["training_data"] as string | undefined
  const license = nd["license"] as string | undefined
  const benchmarks = nd["benchmarks"] as Array<Record<string, unknown>> | undefined
  const arxivUrl = nd["paper_arxiv_url"] as string | undefined
  const githubUrl = nd["github_url"] as string | undefined

  const scoreColor = !showScore || sr === undefined ? t.cardTextSecondary
    : sr > 75 ? t.scoreGreen
    : sr >= 40 ? t.scoreAmber
    : t.scoreRed
  const barColor = !showScore || sr === undefined ? t.scoreBarBg
    : sr > 75 ? t.scoreGreen
    : sr >= 40 ? t.scoreAmber
    : t.scoreRed

  // PM plan 2.1: stronger visual de-emphasis for incompat (score=0)
  // cards. Makes the "these don't work" ones obvious without hiding
  // them. Selected always wins full opacity.
  const incompatOpacity = 0.3
  const compatOpacity = t.dimOpacity
  const resolvedOpacity = opt.selected ? 1 : isIncompat ? incompatOpacity : compatOpacity

  return (
    <div
      className="group relative cursor-pointer rounded-lg shadow-md"
      onClick={onSelect}
      onMouseEnter={(e) => { if (!opt.selected) e.currentTarget.style.opacity = `${isIncompat ? 0.5 : t.dimHoverOpacity}` }}
      onMouseLeave={(e) => { if (!opt.selected) e.currentTarget.style.opacity = `${resolvedOpacity}` }}
      style={{
        backgroundColor: t.cardBg,
        opacity: resolvedOpacity,
        filter: isIncompat && !opt.selected ? "grayscale(0.6)" : "none",
        borderTop: opt.selected ? `3px solid ${t.selectedBorder}` : `2px solid ${t.cardBorder}`,
        borderRight: `2px solid ${t.cardBorder}`,
        borderBottom: `2px solid ${t.cardBorder}`,
        borderLeft: opt.compat !== undefined && !opt.selected ? `3px solid ${opt.compat.color}` : `2px solid ${t.cardBorder}`,
        padding: "12px 10px",
        transition: "width 200ms ease-out, border-color 300ms, opacity 300ms, background-color 300ms, filter 300ms",
      }}
    >
      {/* Compat badge — visual only, click passes through to card so the
          whole card is one consistent hitbox (PM plan 2.4). */}
      {opt.compat !== undefined ? (
        <div
          className="absolute -top-2 -right-2 z-10 rounded font-bold text-white"
          style={{ backgroundColor: opt.compat.color, fontSize: 12, padding: "2px 8px", pointerEvents: "none" }}
        >
          {opt.compat.label}
        </div>
      ) : null}
      {/* Collapse button when expanded */}
      {expanded ? (
        <button
          className="absolute top-2 right-2 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full"
          onClick={(e) => { e.stopPropagation(); onSelect() }}
          style={{ backgroundColor: `${t.cardBg}cc`, color: t.cardTextSecondary }}
          type="button"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
      {/* Name + author */}
      <p style={{ fontSize: 16, fontWeight: 500, color: t.cardText }}>{opt.name}</p>
      {author !== undefined ? (
        <p className="mt-0.5" style={{ fontSize: 13, color: t.cardTextSecondary }}>{author}</p>
      ) : null}
      {/* Profile chip — matches the robot card treatment on /data/robots/<slug>. */}
      {slug !== undefined ? (
        <Link
          className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
          href={`/data/policies/${slug}`}
          onClick={(e) => e.stopPropagation()}
          style={{ backgroundColor: t.tagBg, color: t.cardText }}
          title="Open the full data profile for this policy"
        >
          profile
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
      ) : null}
      {/* Score */}
      <div className="mt-2">
        <span style={{ fontSize: 36, fontWeight: 500, color: scoreColor }}>
          {showScore && sr !== undefined ? `${sr}%` : "--"}
        </span>
        <p className="mt-0.5" style={{ fontSize: 12, color: t.cardTextSecondary }}>
          {showScore && sr !== undefined
            ? tier2
              ? `community-reported${opt.selectedRobotName !== undefined ? ` on ${opt.selectedRobotName}` : ""}`
              : `success${opt.selectedRobotName !== undefined ? ` on ${opt.selectedRobotName}` : " rate"}`
            : "no score"}
        </p>
      </div>
      {/* Score bar */}
      <div className="mt-1.5 overflow-hidden rounded-full" style={{ height: 4, backgroundColor: t.scoreBarBg }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${showScore && sr !== undefined ? sr : 0}%`, backgroundColor: barColor }} />
      </div>
      {/* Architecture tags */}
      <div className="mt-2 flex flex-wrap gap-1">
        {architecture !== undefined ? (
          <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: t.tagBg, color: t.tagText }}>
            {architecture}
          </span>
        ) : null}
        {framework !== undefined && framework !== architecture ? (
          <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: t.tagBg, color: t.tagText }}>
            {framework}
          </span>
        ) : null}
      </div>
      {/* HuggingFace link */}
      {hfRepoId !== undefined ? (
        <a
          className="mt-1.5 block truncate text-[14px] hover:underline"
          href={`https://huggingface.co/${hfRepoId}`}
          onClick={(e) => e.stopPropagation()}
          rel="noopener noreferrer"
          style={{ color: t.linkColor }}
          target="_blank"
        >
          {hfRepoId}
        </a>
      ) : null}
      {/* Compat explanation */}
      {opt.compat !== undefined ? (
        <p className="mt-1 text-[14px] font-medium" style={{ color: opt.compat.color }}>
          {opt.compat.explanation}
        </p>
      ) : null}
      {/* Expanded detail content */}
      {expanded ? (
        <div className="mt-3 border-t pt-3" style={{ borderColor: t.cardBorder }}>
          <div className="divide-y rounded-lg border" style={{ borderColor: t.cardBorder }}>
            {([
              ["Architecture", architecture],
              ["Framework", framework],
              ["Training data", trainingData],
              ["License", license],
            ] as Array<[string, string | undefined]>).filter(([, v]) => v !== undefined).map(([label, value]) => (
              <div className="flex items-center justify-between px-3 py-1.5" key={label} style={{ borderColor: t.cardBorder }}>
                <span className="text-[13px]" style={{ color: t.cardTextSecondary }}>{label}</span>
                <span className="text-[14px] font-medium" style={{ color: t.cardText }}>{value}</span>
              </div>
            ))}
          </div>
          {benchmarks !== undefined && benchmarks.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1.5 text-[13px] font-bold uppercase tracking-wider" style={{ color: t.cardText }}>Benchmarks</p>
              <div className="space-y-1">
                {benchmarks.map((bm, i) => (
                  <div className="flex items-center justify-between rounded border px-2.5 py-1.5" key={i} style={{ borderColor: t.cardBorder }}>
                    <span className="text-[14px]" style={{ color: t.cardText }}>{(bm["robot"] as string | undefined) ?? (bm["name"] as string | undefined) ?? "Benchmark"}</span>
                    <span className="text-[14px] font-medium" style={{ color: t.cardText }}>
                      {(bm["success_rate"] as number | undefined) !== undefined ? `${normalizeSuccessRate(bm["success_rate"] as number)}%` : "--"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {(hfRepoId ?? arxivUrl ?? githubUrl) !== undefined ? (
            <div className="mt-3">
              <p className="mb-1.5 text-[13px] font-bold uppercase tracking-wider" style={{ color: t.cardText }}>Links</p>
              <div className="space-y-1">
                {hfRepoId !== undefined ? (
                  <a className="block truncate text-[14px] hover:underline" href={`https://huggingface.co/${hfRepoId}`} onClick={(e) => e.stopPropagation()} rel="noopener noreferrer" style={{ color: t.linkColor }} target="_blank">
                    HuggingFace: {hfRepoId}
                  </a>
                ) : null}
                {arxivUrl !== undefined ? (
                  <a className="block truncate text-[14px] hover:underline" href={arxivUrl} onClick={(e) => e.stopPropagation()} rel="noopener noreferrer" style={{ color: t.linkColor }} target="_blank">
                    arXiv Paper
                  </a>
                ) : null}
                {githubUrl !== undefined ? (
                  <a className="block truncate text-[14px] hover:underline" href={githubUrl} onClick={(e) => e.stopPropagation()} rel="noopener noreferrer" style={{ color: t.linkColor }} target="_blank">
                    GitHub Repository
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {/* X button (hidden when expanded) */}
      {!expanded ? (
        <button
          className="bg-blueprint-navy/5 text-blueprint-navy/70 hover:bg-blueprint-navy/10 absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          style={{ display: opt.compat !== undefined ? "none" : undefined }}
          type="button"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

interface IEnvCardSim {
  slug: string
  first_episode_video_url: string | null
  episode_count: number
}

/**
 * Fetches the most-recent Simulation matching a (policy × env) pair. When
 * the pair hasn't been rendered yet, returns sim=null and the card offers
 * to POST a fresh render.
 *
 * Previously keyed on envSlug alone and fell back to a hardcoded demo
 * video (ENV_DEMO_VIDEO) when no match existed. That lied to the user:
 * the demo was "sac-humanoid-v3 × mujoco-humanoid-cloth" regardless of
 * which policy they picked. Removed.
 */
function useMatchingSimulation(
  policySlug: string | undefined,
  envSlug: string | undefined,
  /** Bumping this key forces a re-fetch (after a successful POST). */
  refetchNonce: number,
): {
  sim: IEnvCardSim | null
  loading: boolean
} {
  const [sim, setSim] = useState<IEnvCardSim | null>(null)
  const [loading, setLoading] = useState<boolean>(Boolean(envSlug))
  useEffect(() => {
    if (!envSlug) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ environment_slug: envSlug, limit: "1" })
    if (policySlug !== undefined) params.set("policy_slug", policySlug)
    fetch(`/api/simulations?${params.toString()}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ results?: IEnvCardSim[] }>) : { results: [] }))
      .then((body) => {
        if (cancelled) return
        setSim(body.results?.[0] ?? null)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setSim(null)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [policySlug, envSlug, refetchNonce])
  return { sim, loading }
}

/**
 * POSTs a fresh simulation to /api/simulations and polls until the first
 * episode is done. Returns transient state the card uses to show a
 * loading pill, then re-triggers the sim query above once the server
 * has the video URL.
 */
function useRenderSimulation(): {
  status: "idle" | "submitting" | "rendering" | "done" | "error"
  error: string | null
  render: (args: {
    policy_slug: string
    environment_slug: string
    task_slug?: string
    robot_slug?: string
  }) => Promise<void>
  resetKey: number
} {
  const [status, setStatus] = useState<"idle" | "submitting" | "rendering" | "done" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)

  const render = async (args: {
    policy_slug: string
    environment_slug: string
    task_slug?: string
    robot_slug?: string
  }): Promise<void> => {
    setStatus("submitting")
    setError(null)
    try {
      const postRes = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...args, episode_count: 1 }),
      })
      if (!postRes.ok) {
        const txt = await postRes.text()
        setError(`submit failed (${String(postRes.status)}): ${txt.slice(0, 200)}`)
        setStatus("error")
        return
      }
      const created = (await postRes.json()) as { id?: string; slug?: string }
      const simSlug = created.slug
      if (simSlug === undefined || simSlug.length === 0) {
        setError("submit returned no slug — oneclick pipeline may be degraded")
        setStatus("error")
        return
      }
      setStatus("rendering")
      // Poll /api/simulations/:slug for episode-level status. A failed
      // episode carries error_message; we surface it immediately rather
      // than sitting through the 4-min timeout.
      const startedAt = Date.now()
      const MAX_MS = 4 * 60 * 1000
      while (Date.now() - startedAt < MAX_MS) {
        await new Promise((r) => setTimeout(r, 3000))
        const pollRes = await fetch(`/api/simulations/${encodeURIComponent(simSlug)}`)
        if (!pollRes.ok) continue
        const body = (await pollRes.json()) as {
          episodes?: Array<{ status?: string; video_url?: string | null; error_message?: string | null }>
        }
        const ep = body.episodes?.[0]
        if (!ep) continue
        if (ep.status === "done" && typeof ep.video_url === "string" && ep.video_url.length > 0) {
          setStatus("done")
          setResetKey((k) => k + 1)
          return
        }
        if (ep.status === "failed") {
          const msg = ep.error_message ?? "oneclick render failed (no error message returned)"
          setError(msg.length > 240 ? `${msg.slice(0, 237)}...` : msg)
          setStatus("error")
          return
        }
      }
      setError("render timed out after 4 min — oneclick may still be working in the background")
      setStatus("error")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus("error")
    }
  }

  return { status, error, render, resetKey }
}

export function EnvironmentCard({ opt, onSelect, onRemove }: { opt: ILaneOption; onSelect: () => void; onRemove: () => void }) {
  const nd = opt.nodeData
  const simulator = (nd["simulator"] as string | undefined) ?? "MuJoCo"
  const envSlug = typeof nd["slug"] === "string" ? (nd["slug"] as string) : undefined
  const policySlug = opt.selectedPolicySlug
  const { render, status, error, resetKey } = useRenderSimulation()
  const { sim, loading } = useMatchingSimulation(policySlug, envSlug, resetKey)
  const [lightbox, setLightbox] = useState(false)

  const hasVideo = sim?.first_episode_video_url !== null && sim?.first_episode_video_url !== undefined
  const hasPendingSim = sim !== null && !hasVideo
  const videoSrc = hasVideo && sim?.first_episode_video_url ? sim.first_episode_video_url : null
  // When no dynamic sim exists, link to the simulations list (always resolves)
  // rather than a specific slug that may not exist in the local DB.
  const simHref = sim?.slug ? `/data/simulations/${sim.slug}` : `/data/simulations`
  const isRendering = status === "submitting" || status === "rendering"

  // Gate the Render button on the two "we can actually run this" checks.
  // (1) simulator must be MuJoCo — oneclick-policy only supports MuJoCo
  //     today. Isaac Sim / Habitat envs show "Coming Soon" so we signal
  //     roadmap instead of 500ing oneclick.
  // (2) policy must have an HF repo id. Closed-source models like Helix
  //     ship as stubs with hf_repo_id=null; renders would fail at the
  //     oneclick /auto_deploy step.
  const simulatorSupported = simulator.toLowerCase().includes("mujoco")
  const policyRunnable = opt.selectedPolicyHfRepoId !== undefined
  const canRender = simulatorSupported && policyRunnable && policySlug !== undefined && envSlug !== undefined
  const comingSoonReason = !simulatorSupported
    ? `${simulator} support coming soon`
    : !policyRunnable && opt.selectedPolicySlug !== undefined
    ? `${opt.selectedPolicySlug} is closed-source — coming soon`
    : null

  const handleRender = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (!canRender || isRendering || envSlug === undefined || policySlug === undefined) return
    void render({
      policy_slug: policySlug,
      environment_slug: envSlug,
      robot_slug: opt.selectedRobotSlug,
    })
  }

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightbox) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(false) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [lightbox])

  return (
    <>
      <div
        className="group relative shrink-0 cursor-pointer overflow-hidden rounded-lg transition-all"
        onClick={onSelect}
        style={{
          backgroundColor: "#111",
          border: opt.selected ? "2px solid #FFD326" : "1.5px solid #444",
          transition: "border-color 300ms, opacity 300ms",
          opacity: opt.selected ? 1 : 0.7,
        }}
      >
        {/* Preview area. Three states:
            (a) videoSrc exists → playable preview, click opens lightbox
            (b) isRendering → spinner + "rendering…"
            (c) empty → "No simulation yet" + Render button (if we have a
                policy selected) or a disabled hint (if no policy)          */}
        <div
          className="relative flex items-center justify-center"
          onClick={videoSrc !== null ? (e) => { e.stopPropagation(); setLightbox(true) } : undefined}
          style={{ height: 110, backgroundColor: "#1a1a1a", cursor: videoSrc !== null ? "zoom-in" : "default" }}
        >
          {videoSrc !== null ? (
            <video
              loop
              muted
              aria-label={`${opt.name} — episode preview`}
              className="h-full w-full object-cover"
              onMouseEnter={(e) => { void e.currentTarget.play().catch(() => undefined) }}
              onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
              preload="metadata"
              src={videoSrc}
            />
          ) : isRendering || hasPendingSim ? (
            <div className="flex flex-col items-center justify-center gap-1.5">
              <div
                className="animate-spin rounded-full"
                style={{ width: 22, height: 22, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFD326" }}
              />
              <span style={{ fontSize: 9, color: "#FFD326", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                {status === "submitting" ? "submitting…" : "rendering…"}
              </span>
            </div>
          ) : canRender ? (
            <div className="flex flex-col items-center justify-center gap-1.5 px-3 text-center">
              <p style={{ fontSize: 10, color: "#888", letterSpacing: "0.3px", textTransform: "uppercase" }}>No simulation yet</p>
              <button
                className="highlight-pulse-dark rounded-full px-3 py-1 text-[13px] font-bold uppercase tracking-wider transition-colors hover:bg-yellow-400"
                onClick={handleRender}
                style={{ backgroundColor: "#FFD326", color: "#0B1C36" }}
                type="button"
              >
                Render ▶
              </button>
            </div>
          ) : comingSoonReason !== null ? (
            <div className="flex flex-col items-center justify-center gap-1.5 px-3 text-center">
              <p style={{ fontSize: 11, fontWeight: 700, color: "#FFD326", letterSpacing: "0.5px", textTransform: "uppercase" }}>Coming soon</p>
              <p style={{ fontSize: 9, color: "#aaa", lineHeight: 1.3 }}>{comingSoonReason}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 px-3 text-center">
              <p style={{ fontSize: 10, color: "#888", letterSpacing: "0.3px", textTransform: "uppercase" }}>No simulation yet</p>
              <p style={{ fontSize: 9, color: "#555", lineHeight: 1.3 }}>
                Pick a policy above to enable rendering
              </p>
            </div>
          )}
          {/* Play hint — only over a real video */}
          {videoSrc !== null ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity group-hover:opacity-0">
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 36, height: 36, border: "2px solid rgba(255,255,255,0.4)", backgroundColor: "rgba(0,0,0,0.5)" }}
              >
                <svg className="ml-0.5" fill="white" height="14" viewBox="0 0 24 24" width="14">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ padding: "8px 10px 10px" }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#eee" }}>{opt.name}</p>
          <p className="mt-0.5" style={{ fontSize: 11, color: "#888" }}>{simulator}</p>
          {error !== null ? (
            <p className="mt-1.5" style={{ fontSize: 9, color: "#F09595", lineHeight: 1.3 }}>{error}</p>
          ) : loading ? (
            <p className="mt-1.5" style={{ fontSize: 10, color: "#555" }}>&nbsp;</p>
          ) : sim !== null ? (
            <a
              className="mt-1.5 block hover:underline"
              href={simHref}
              onClick={(e) => e.stopPropagation()}
              rel="noopener noreferrer"
              style={{ fontSize: 10, color: "#FFD326" }}
              target="_blank"
            >
              Open in simulation &rarr;
            </a>
          ) : null}
        </div>

        {/* Remove (X) button */}
        <button
          className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#888" }}
          type="button"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Lightbox — rendered outside the card so it's not clipped by overflow:hidden */}
      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={() => setLightbox(false)}
          style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
        >
          {/* X — top-right of the backdrop */}
          <button
            className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/20"
            onClick={() => setLightbox(false)}
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
            type="button"
          >
            <svg fill="none" height="16" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" width="16">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div
            className="relative w-full overflow-hidden rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#0d0d0d", maxWidth: "min(90vw, 960px)" }}
          >
            {/* Video — fills width, aspect-video keeps it proportional */}
            <video
              autoPlay
              controls
              loop
              aria-label={`${opt.name} — full episode`}
              className="aspect-video w-full"
              src={videoSrc ?? undefined}
              style={{ objectFit: "contain", backgroundColor: "#000", display: "block" }}
            />
            {/* Info bar */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", letterSpacing: "-0.01em" }}>{opt.name}</p>
                <p style={{ fontSize: 11, color: "#555", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>{simulator}</p>
              </div>
              <a
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-white/10"
                href={simHref}
                rel="noopener noreferrer"
                style={{ color: "#FFD326", fontFamily: "monospace", border: "1px solid rgba(255,211,38,0.3)" }}
                target="_blank"
              >
                {sim ? "Open simulation" : "View demo"} →
              </a>
            </div>
          </div>

        </div>
      ) : null}
    </>
  )
}
