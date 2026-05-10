"use client"

/**
 * Canvas node components + BullpenBar + shared helpers.
 *
 * Moved out of workbench-canvas.tsx in spec 029 phase 3.4.5 to shrink
 * the monster file ahead of Step 3.5's confirmation-card surgery.
 * ZERO behavior change — this is a straight extract.
 *
 * Contents:
 *   - NodeImage (shared by cards + standalone nodes)
 *   - DeploymentNodeComponent (safety / deploy-readiness node)
 *   - StandaloneNodeComponent (fallback node type)
 *   - BullpenBar (top-bar specialist indicator)
 *   - ICanvasStatus / IAskUser types
 *   - SPECIALIST_COLORS / ROSTER / TOOLTIP_DESCS constants
 *
 * ExplorationLaneComponent STAYS in workbench-canvas.tsx because it
 * imports the lane cards (HardwareCard/PolicyCard/EnvironmentCard) —
 * keeping it there avoids a circular import between canvas-nodes and
 * lane-cards, at the cost of ~60 lines in the main file.
 */

import Image from "next/image"
import { useState } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import type { ITheme } from "./canvas-theme"

// ── Types ───────────────────────────────────────────────────────────

export interface ICanvasStatus { nodeId?: string; text: string; specialist: string }
export interface IAskUser { question: string; options?: string[] }

// ── Specialist roster + colors ──────────────────────────────────────

export const SPECIALIST_COLORS: Record<string, { bg: string; tint: string; border: string; label: string }> = {
  task: { bg: "bg-lime-600", tint: "bg-lime-600/5", border: "border-l-lime-600", label: "Task Analyst" },
  hardware: { bg: "bg-blue-500", tint: "bg-blue-500/5", border: "border-l-blue-500", label: "Hardware Scout" },
  policy: { bg: "bg-purple-500", tint: "bg-purple-500/5", border: "border-l-purple-500", label: "Policy Scout" },
  simulation: { bg: "bg-teal-500", tint: "bg-teal-500/5", border: "border-l-teal-500", label: "Sim Engineer" },
  community: { bg: "bg-amber-500", tint: "bg-amber-500/5", border: "border-l-amber-500", label: "Community Scout" },
  deployment: { bg: "bg-red-500", tint: "bg-red-500/5", border: "border-l-red-500", label: "Deploy Advisor" },
}

export const ROSTER = [
  { key: "task", letter: "T", name: "Task Analyst", shortName: "Task", desc: "Decomposing goals into sub-skills, difficulty, success criteria", bg: "#EAF3DE", text: "#27500A", ring: "#6FA033" },
  { key: "hardware", letter: "H", name: "Hardware Scout", shortName: "Hardware", desc: "Hardware, specs, costs, build paths, what robots can and can't do", bg: "#E6F1FB", text: "#0C447C", ring: "#5B9FD6" },
  { key: "policy", letter: "P", name: "Policy Scout", shortName: "Policy", desc: "Training architectures, benchmarks, which policies fit which tasks", bg: "#EEEDFE", text: "#3C3489", ring: "#8B7FD4" },
  { key: "simulation", letter: "S", name: "Sim Engineer", shortName: "Sim", desc: "Physics tuning, environments, sim-to-real transfer", bg: "#E1F5EE", text: "#085041", ring: "#3EAD8A" },
  { key: "community", letter: "C", name: "Community Scout", shortName: "Community", desc: "Community gaps, missing datasets, how you can help the ecosystem", bg: "#FAEEDA", text: "#633806", ring: "#D4A03A" },
  { key: "deployment", letter: "D", name: "Deploy Advisor", shortName: "Deploy", desc: "Safety, regulatory, insurance, real-world gotchas", bg: "#FCEBEB", text: "#791F1F", ring: "#D45B5B" },
] as const

export const TOOLTIP_DESCS: Record<string, string> = {
  task: "AI agent specialized in decomposing goals into sub-skills, difficulty, and success criteria",
  hardware: "AI agent specialized in hardware, specs, costs, build paths — what robots can and can’t do",
  policy: "AI agent specialized in training architectures, benchmarks — which policies fit which tasks",
  simulation: "AI agent specialized in physics tuning, environments, and sim-to-real transfer",
  community: "AI agent specialized in community gaps, missing datasets, and how you can help",
  deployment: "AI agent specialized in safety, regulatory, insurance, maintenance — real-world gotchas",
}

// ── BullpenBar (top-bar specialist indicator) ────────────────────────

export function BullpenBar({ activeSpecialists, activeStatuses, hoveredKey, pinnedKey, onHover, onPin }: {
  activeSpecialists: Set<string>
  activeStatuses: Record<string, string>
  hoveredKey: string | null
  pinnedKey: string | null
  onHover: (key: string | null) => void
  onPin: (key: string | null) => void
}) {
  const visibleKey = hoveredKey ?? pinnedKey
  const visibleRoster = visibleKey !== null ? ROSTER.find((r) => r.key === visibleKey) : undefined

  return (
    <div className="shrink-0" style={{ backgroundColor: "rgba(11,28,54,0.03)", borderBottom: "0.5px solid rgba(11,28,54,0.08)" }}>
      <div
        className="flex items-center gap-2 px-4"
        style={{ height: 44 }}
      >
        <span className="text-blueprint-navy/40 mr-1 select-none text-[13px] font-semibold uppercase tracking-wider">AI Agents</span>
        {ROSTER.map((r) => {
          const isActive = activeSpecialists.has(r.key)
          const isVisible = r.key === visibleKey
          const status = activeStatuses[r.key]
          return (
            <button
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all"
              key={r.key}
              onClick={(e) => { e.stopPropagation(); onPin(pinnedKey === r.key ? null : r.key) }}
              onMouseEnter={() => onHover(r.key)}
              onMouseLeave={() => onHover(null)}
              style={{
                backgroundColor: isVisible ? `${r.bg}` : isActive ? `${r.bg}60` : `${r.bg}30`,
                border: `1px solid ${isVisible ? r.ring : isActive ? `${r.ring}60` : `${r.ring}20`}`,
              }}
              type="button"
            >
              <div className="relative shrink-0">
                {isActive ? (
                  <div
                    className="absolute -inset-0.5 rounded-full"
                    style={{ border: `2px solid ${r.ring}`, animation: "specialistPulse 2s ease-in-out infinite" }}
                  />
                ) : null}
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 20, height: 20,
                    backgroundColor: isVisible ? `${r.ring}` : r.bg,
                    color: isVisible ? "#fff" : r.text,
                    fontSize: 9, fontWeight: 700,
                    opacity: isActive || isVisible ? 1 : 0.6,
                  }}
                >
                  {r.letter}
                </div>
              </div>
              <span
                className="text-xs"
                style={{ fontWeight: 500, color: isVisible ? r.text : isActive ? r.text : `${r.text}90` }}
              >
                {r.shortName}
              </span>
              {isActive && status !== undefined ? (
                <span className="text-[13px]" style={{ color: r.text }}>
                  {status.length > 30 ? `${status.slice(0, 27)}...` : status}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {/* Tooltip below the bar, colored to match specialist */}
      {visibleRoster !== undefined && TOOLTIP_DESCS[visibleRoster.key] !== undefined ? (
        <div className="px-4 pb-2">
          <div
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5"
            style={{ backgroundColor: visibleRoster.bg, border: `1px solid ${visibleRoster.ring}40` }}
          >
            <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: visibleRoster.ring }} />
            <span className="text-[14px]" style={{ color: visibleRoster.text }}><strong>{visibleRoster.name}</strong> — {TOOLTIP_DESCS[visibleRoster.key]}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Image with fallback ─────────────────────────────────────────────

export function NodeImage({ alt, height, src }: { alt: string; height: number; src: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="bg-blueprint-navy/5 text-blueprint-navy/30 flex items-center justify-center rounded text-sm font-bold" style={{ height }}>
        {alt.charAt(0)}
      </div>
    )
  }
  return (
    <Image
      unoptimized
      alt={alt}
      className="object-contain"
      height={height}
      onError={() => setFailed(true)}
      src={src}
      style={{ height, width: "auto" }}
      width={Math.round(height * 1.5)}
    />
  )
}

// ── Deployment Node (safety / deploy-readiness) ────────────────────

export function DeploymentNodeComponent({ data }: NodeProps) {
  const d = data as { nodeData: Record<string, unknown>; nodeStatus: string; theme: ITheme; expanded: boolean; onToggleExpand: () => void }
  const nd = d.nodeData
  const name = (nd["name"] as string | undefined) ?? (nd["robot_name"] as string | undefined) ?? "Assessment"
  const status = (nd["deploy_readiness"] as string | undefined) ?? (nd["status"] as string | undefined) ?? "unknown"
  const summary = (nd["summary"] as string | undefined) ?? (nd["message"] as string | undefined) ?? (nd["description"] as string | undefined)
  const isLabOnly = status === "lab_only" || status.toLowerCase().includes("lab")
  const certs = nd["certifications"] as string | undefined
  const regulatory = nd["regulatory"] as string | undefined
  const insurance = nd["insurance"] as string | undefined
  const risks = nd["risks"] as string[] | undefined
  const deployCost = nd["estimated_cost"] as string | undefined

  return (
    <div className="rounded-xl shadow-md" style={{ padding: 14, width: 340, backgroundColor: "rgba(252,235,235,0.85)", border: "1.5px solid #F09595", transition: "background-color 300ms" }}>
      <Handle className="!bg-transparent !border-0 !w-0 !h-0" position={Position.Left} type="target" />
      <Handle className="!bg-transparent !border-0 !w-0 !h-0" position={Position.Right} type="source" />
      <div className="mb-1.5 flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: "#D45B5B" }} />
        <p className="text-[13px] font-bold uppercase tracking-widest" style={{ color: "#791F1F" }}>Deploy Assessment</p>
      </div>
      <p className="font-medium" style={{ fontSize: 13, color: "#0B1C36" }}>{name}</p>
      <p className="mt-1 font-bold" style={{ fontSize: 14, color: isLabOnly ? "#791F1F" : "#085041" }}>
        {isLabOnly ? "Lab only" : "Field ready"}
      </p>
      {summary !== undefined ? (
        <p className="mt-1 leading-relaxed" style={{ fontSize: 12, color: "#6B7280" }}>{summary}</p>
      ) : null}
      {d.expanded ? (
        <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: "rgba(209,95,95,0.2)" }}>
          {certs !== undefined ? (
            <div className="flex justify-between text-[14px]">
              <span style={{ color: "#6B7280" }}>Certifications</span>
              <span style={{ color: "#0B1C36" }}>{certs}</span>
            </div>
          ) : null}
          {regulatory !== undefined ? (
            <div className="flex justify-between text-[14px]">
              <span style={{ color: "#6B7280" }}>Regulatory</span>
              <span style={{ color: "#0B1C36" }}>{regulatory}</span>
            </div>
          ) : null}
          {insurance !== undefined ? (
            <div className="flex justify-between text-[14px]">
              <span style={{ color: "#6B7280" }}>Insurance</span>
              <span style={{ color: "#0B1C36" }}>{insurance}</span>
            </div>
          ) : null}
          {deployCost !== undefined ? (
            <div className="flex justify-between text-[14px]">
              <span style={{ color: "#6B7280" }}>Est. deploy cost</span>
              <span style={{ color: "#0B1C36" }}>{deployCost}</span>
            </div>
          ) : null}
          {risks !== undefined && risks.length > 0 ? (
            <div className="mt-1">
              <p className="mb-1 text-[13px] font-bold uppercase" style={{ color: "#791F1F" }}>Known Risks</p>
              <ul className="space-y-0.5">
                {risks.map((r, i) => (
                  <li className="text-[14px]" key={i} style={{ color: "#6B7280" }}>- {r}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      <button
        className="mt-2 cursor-pointer text-[13px] font-medium"
        onClick={(e) => { e.stopPropagation(); d.onToggleExpand() }}
        style={{ color: "#D45B5B" }}
        type="button"
      >
        {d.expanded ? "Collapse" : "Show full assessment"}
      </button>
    </div>
  )
}

// ── Standalone Node (fallback node type) ───────────────────────────

export function StandaloneNodeComponent({ data }: NodeProps) {
  const d = data as { nodeData: Record<string, unknown>; nodeType: string; nodeStatus: string; onSelect?: () => void; theme: ITheme }
  const nd = d.nodeData
  const t = d.theme
  const name = (nd["name"] as string | undefined) ?? "Untitled"

  return (
    <div className="rounded-xl shadow-md" style={{ padding: 16, width: 340, backgroundColor: t.standaloneBg, border: d.nodeStatus === "selected" ? `2px solid ${t.selectedBorder}` : `1px solid ${t.standaloneBorder}`, transition: "background-color 300ms, border-color 300ms" }}>
      <Handle className="!bg-transparent !border-0 !w-0 !h-0" position={Position.Left} type="target" />
      <Handle className="!bg-transparent !border-0 !w-0 !h-0" position={Position.Right} type="source" />
      <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: t.standaloneTextSecondary }}>{d.nodeType}</p>
      {(nd["image_url"] as string | undefined) !== undefined ? (
        <div className="mb-3 flex items-center justify-center">
          <NodeImage alt={name} height={120} src={nd["image_url"] as string} />
        </div>
      ) : null}
      <p className="font-medium" style={{ fontSize: 18, color: t.standaloneText }}>{name}</p>
      {(nd["description"] as string | undefined) !== undefined ? (
        <p className="mt-1 leading-relaxed" style={{ fontSize: 14, color: t.standaloneTextSecondary }}>{nd["description"] as string}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(nd["price"] as number | undefined) !== undefined ? <span className="rounded px-2 py-0.5 text-xs" style={{ backgroundColor: t.tagBg, color: t.tagText }}>${nd["price"] as number}</span> : null}
        {(nd["dof"] as number | undefined) !== undefined ? <span className="rounded px-2 py-0.5 text-xs" style={{ backgroundColor: t.tagBg, color: t.tagText }}>{nd["dof"] as number}-DoF</span> : null}
        {(nd["deploy_readiness"] as string | undefined) !== undefined ? (
          <span className="rounded px-2 py-0.5 text-xs font-bold" style={nd["deploy_readiness"] === "lab_only" ? { backgroundColor: t.deployLabOnly.bg, color: t.deployLabOnly.text } : { backgroundColor: t.deployCeMarked.bg, color: t.deployCeMarked.text }}>
            {nd["deploy_readiness"] as string}
          </span>
        ) : null}
      </div>
    </div>
  )
}
