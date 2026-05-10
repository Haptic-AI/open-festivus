"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useUser } from "@clerk/nextjs"
import type { IProjectSummary } from "@festivus/types"

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return days === 1 ? "yesterday" : `${days}d ago`
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

interface IProjectDrawerProps {
  open: boolean
  onClose: () => void
  isMigrating?: boolean
  currentProjectId?: string
}

export function ProjectDrawer({ open, onClose, isMigrating = false, currentProjectId }: IProjectDrawerProps) {
  const { isSignedIn, isLoaded } = useUser()
  const [projects, setProjects] = useState<IProjectSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || isMigrating || !open) return
    setLoaded(false)
    void fetch("/api/workbench")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: IProjectSummary[]) => {
        setProjects(data)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [isLoaded, isSignedIn, isMigrating, open])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open, onClose])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!isLoaded || !isSignedIn) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{
          backgroundColor: "rgba(11,28,54,0.15)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* Drawer panel */}
      <div
        className="fixed top-0 left-0 z-50 flex h-full flex-col shadow-2xl transition-transform duration-200 ease-out"
        ref={panelRef}
        style={{
          width: 280,
          backgroundColor: "#0B1C36",
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-drafting-cream font-mono text-[14px] font-bold uppercase tracking-[0.15em]">
            Your Projects
          </span>
          <button
            className="text-drafting-cream/50 hover:text-drafting-cream cursor-pointer transition-colors"
            onClick={onClose}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto">
          {!loaded ? (
            <div className="text-drafting-cream/30 px-4 py-8 text-center text-xs">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-drafting-cream/40 text-xs">
                No projects yet. Start one from the workbench.
              </p>
            </div>
          ) : (
            <div className="flex flex-col py-1">
              {projects.map((project) => {
                const isCurrent = project.projectId === currentProjectId
                return (
                  <Link
                    className="group flex flex-col gap-1 px-4 py-3 transition-colors"
                    href={`/workbench/${project.projectId}`}
                    key={project.projectId}
                    onClick={onClose}
                    onMouseEnter={(e) => {
                      if (!isCurrent) e.currentTarget.style.backgroundColor = "rgba(239,236,228,0.05)"
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent) e.currentTarget.style.backgroundColor = "transparent"
                    }}
                    style={{
                      backgroundColor: isCurrent ? "rgba(239,236,228,0.08)" : "transparent",
                    }}
                  >
                    <span className="text-drafting-cream line-clamp-1 text-xs font-semibold leading-tight">
                      {project.name || "Untitled Project"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-drafting-cream/30 text-[13px]">
                        {project.nodeCount} {project.nodeCount === 1 ? "node" : "nodes"}
                      </span>
                      <span className="text-drafting-cream/20 text-[13px]">·</span>
                      <span className="text-drafting-cream/30 text-[13px]">
                        {relativeTime(project.updatedAt)}
                      </span>
                      <span className="text-drafting-cream/20 text-[13px]">·</span>
                      <span className="text-drafting-cream/20 font-mono text-[13px]">
                        {project.projectId}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-4 py-3">
          <Link
            className="text-drafting-cream/40 hover:text-drafting-cream block text-center text-[13px] font-bold uppercase tracking-wider transition-colors"
            href="/workbench"
            onClick={onClose}
          >
            + New Project
          </Link>
        </div>
      </div>
    </>
  )
}
