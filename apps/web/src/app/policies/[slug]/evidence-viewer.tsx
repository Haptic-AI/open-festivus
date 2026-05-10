"use client"

import { useState } from "react"
import type { ICompatibilityEntry, IHardwareCompatibility } from "@festivus/types"
import { useRobotSelection } from "./robot-selection"

interface IEvidenceViewerProps {
  compatibility: ICompatibilityEntry[]
  verifiedBy?: string
}

function totalEvidence(entry: ICompatibilityEntry): number {
  return (entry.realWorld.episodes ?? 0) +
    (entry.simulation.episodes ?? 0) +
    (entry.realWorld.videoUrl !== undefined ? 100 : 0) +
    (entry.simulation.videoUrl !== undefined ? 100 : 0)
}

const COMPAT_STYLES: Record<IHardwareCompatibility, { label: string; className: string }> = {
  yes: { label: "Yes", className: "bg-green-600/10 text-green-700 font-bold" },
  partial: { label: "Partial", className: "bg-yellow-500/10 text-yellow-700 font-bold" },
  no: { label: "No", className: "bg-annotation-red/10 text-annotation-red font-bold" },
  untested: { label: "Untested", className: "bg-cold-gray/20 text-blueprint-navy/70" },
}

function EvidencePanel({ entry }: { entry: ICompatibilityEntry }) {
  return (
    <div>
      <h3 className="text-blueprint-navy mb-4 text-lg font-bold uppercase tracking-tight">
        {entry.robotName}
      </h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="border-blueprint-navy/10 border p-5">
          <p className="text-blueprint-navy/70 mb-3 text-xs font-bold uppercase tracking-[0.2em]">Real World</p>
          {entry.realWorld.status === "tested" ? (
            <div>
              {entry.realWorld.videoUrl !== undefined ? (
                <div className="mb-4 aspect-video">
                  <iframe
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    className="h-full w-full"
                    src={entry.realWorld.videoUrl}
                    title={`${entry.robotName} real world demo`}
                  />
                </div>
              ) : null}
              <div className="space-y-2 text-sm">
                {entry.realWorld.successRate !== undefined ? (
                  <p><span className="text-blueprint-navy/70">Success rate:</span> <span className="text-blueprint-navy font-bold">{entry.realWorld.successRate}%</span></p>
                ) : null}
                {entry.realWorld.episodes !== undefined ? (
                  <p><span className="text-blueprint-navy/70">Episodes:</span> <span className="text-blueprint-navy">{entry.realWorld.episodes.toLocaleString()}</span></p>
                ) : null}
                {entry.realWorld.hoursLogged !== undefined ? (
                  <p><span className="text-blueprint-navy/70">Hours:</span> <span className="text-blueprint-navy">{entry.realWorld.hoursLogged}</span></p>
                ) : null}
                {entry.realWorld.environment !== undefined ? (
                  <p><span className="text-blueprint-navy/70">Environment:</span> <span className="text-blueprint-navy">{entry.realWorld.environment}</span></p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-blueprint-navy/70 text-sm italic">No real-world data for {entry.robotName}.</p>
          )}
        </div>
        <div className="border-blueprint-navy/10 border p-5">
          <p className="text-blueprint-navy/70 mb-3 text-xs font-bold uppercase tracking-[0.2em]">Simulation</p>
          {entry.simulation.status === "tested" ? (
            <div>
              {entry.simulation.videoUrl !== undefined ? (
                <div className="mb-4 aspect-video">
                  <iframe
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    className="h-full w-full"
                    src={entry.simulation.videoUrl}
                    title={`${entry.robotName} simulation demo`}
                  />
                </div>
              ) : null}
              <div className="space-y-2 text-sm">
                {entry.simulation.successRate !== undefined ? (
                  <p><span className="text-blueprint-navy/70">Success rate:</span> <span className="text-blueprint-navy font-bold">{entry.simulation.successRate}%</span></p>
                ) : null}
                {entry.simulation.episodes !== undefined ? (
                  <p><span className="text-blueprint-navy/70">Episodes:</span> <span className="text-blueprint-navy">{entry.simulation.episodes.toLocaleString()}</span></p>
                ) : null}
                {entry.simulation.simulator !== undefined ? (
                  <p><span className="text-blueprint-navy/70">Simulator:</span> <span className="text-blueprint-navy">{entry.simulation.simulator}</span></p>
                ) : null}
                {entry.simulation.scene !== undefined ? (
                  <p><span className="text-blueprint-navy/70">Scene:</span> <span className="text-blueprint-navy">{entry.simulation.scene}</span></p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-blueprint-navy/70 text-sm italic">No simulation data for {entry.robotName}.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function EvidenceViewer({ compatibility, verifiedBy }: IEvidenceViewerProps) {
  const { selectedSlugs, toggleRobot, hasSelection } = useRobotSelection()
  const [localTab, setLocalTab] = useState<string | null>(null)

  const bestDefault = [...compatibility].sort((a, b) => totalEvidence(b) - totalEvidence(a))[0]

  // Video previews: show selected robot, or local tab override, or best default
  const activeSlug = localTab ?? (hasSelection ? [...selectedSlugs][0] ?? null : null)
  const evidenceEntry = activeSlug !== null
    ? compatibility.find((c) => c.robotSlug === activeSlug) ?? bestDefault
    : bestDefault

  return (
    <div className="mb-6 space-y-6">
      {/* Hardware Compatibility */}
      <details open className="group">
        <summary className="border-blueprint-navy/10 cursor-pointer list-none border p-6 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-blueprint-navy text-xl font-bold uppercase tracking-tight md:text-2xl">
              Hardware Compatibility
            </h2>
            <svg className="text-blueprint-navy/60 h-5 w-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
            </svg>
          </div>
        </summary>
        <div className="border-blueprint-navy/10 border-x border-b p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-blueprint-navy/10 border-b">
                  <th className="text-blueprint-navy/70 pb-3 pr-6 text-xs font-bold uppercase tracking-wider">Robot</th>
                  <th className="text-blueprint-navy/70 pb-3 pr-6 text-xs font-bold uppercase tracking-wider">Compatible</th>
                  <th className="text-blueprint-navy/70 pb-3 text-xs font-bold uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody>
                {compatibility.map((entry) => {
                  const isSelected = selectedSlugs.has(entry.robotSlug)
                  const isDimmed = hasSelection && !isSelected
                  const style = COMPAT_STYLES[entry.hardwareCompatibility]
                  return (
                    <tr
                      className={`border-blueprint-navy/5 cursor-pointer border-b transition-all ${
                        isSelected ? "bg-blueprint-navy/5" : isDimmed ? "opacity-40 hover:opacity-70" : "hover:bg-blueprint-navy/[0.02]"
                      }`}
                      key={entry.robotSlug}
                      onClick={() => toggleRobot(entry.robotSlug)}
                    >
                      <td className="text-blueprint-navy py-3 pr-6 font-bold">{entry.robotName}</td>
                      <td className="py-3 pr-6">
                        <span className={`px-2 py-0.5 text-xs ${style.className}`}>{style.label}</span>
                      </td>
                      <td className="text-blueprint-navy/70 py-3 text-xs">{entry.compatibilityNote ?? "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-blueprint-navy/70 mt-4 text-xs italic">
            Your robot isn&apos;t listed? Try it in the Sandbox below.
          </p>
        </div>
      </details>

      {/* Video Previews */}
      {evidenceEntry !== undefined ? (
        <details open className="group">
          <summary className="border-blueprint-navy/10 cursor-pointer list-none border p-6 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-blueprint-navy text-xl font-bold uppercase tracking-tight md:text-2xl">
                Video Previews
              </h2>
              <svg className="text-blueprint-navy/60 h-5 w-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </div>
          </summary>
          <div className="border-blueprint-navy/10 border-x border-b p-6">
            {verifiedBy !== undefined ? (
              <p className="text-blueprint-navy/70 mb-4 text-xs">Verified by {verifiedBy}</p>
            ) : null}
            {compatibility.length > 1 ? (
              <div className="mb-6 flex flex-wrap gap-2">
                {compatibility.map((entry) => (
                  <button
                    className={`cursor-pointer border px-3 py-1.5 text-xs font-bold transition-colors ${
                      evidenceEntry.robotSlug === entry.robotSlug
                        ? "bg-blueprint-navy text-drafting-cream border-blueprint-navy"
                        : "border-blueprint-navy/20 text-blueprint-navy hover:border-blueprint-navy"
                    }`}
                    key={entry.robotSlug}
                    onClick={() => setLocalTab(entry.robotSlug)}
                    type="button"
                  >
                    {entry.robotName}
                  </button>
                ))}
              </div>
            ) : null}
            <EvidencePanel entry={evidenceEntry} />
          </div>
        </details>
      ) : null}
    </div>
  )
}
