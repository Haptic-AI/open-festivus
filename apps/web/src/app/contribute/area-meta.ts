/**
 * Shared area styling + helpers for the /tasks page surfaces.
 *
 * Safe to import from both server and client components.
 */

import type { TaskArea } from "./fetch-tasks-types"

export interface IAreaStyle {
  name: string
  accent: string
  bg: string
  text: string
  border: string
}

export const AREA_STYLES: Record<TaskArea, IAreaStyle> = {
  robots:      { name: "Robots",      accent: "#1d76db", bg: "bg-[#1d76db]/10", text: "text-[#1d76db]", border: "border-[#1d76db]/40" },
  policies:    { name: "Policies",    accent: "#5319e7", bg: "bg-[#5319e7]/10", text: "text-[#5319e7]", border: "border-[#5319e7]/40" },
  simulations: { name: "Simulations", accent: "#0e8a16", bg: "bg-[#0e8a16]/10", text: "text-[#0e8a16]", border: "border-[#0e8a16]/40" },
  datasets:    { name: "Datasets",    accent: "#d93f0b", bg: "bg-[#d93f0b]/10", text: "text-[#d93f0b]", border: "border-[#d93f0b]/40" },
  papers:      { name: "Papers",      accent: "#a87408", bg: "bg-[#f9a826]/10", text: "text-[#a87408]", border: "border-[#f9a826]/40" },
  platform:    { name: "Platform",    accent: "#444444", bg: "bg-black/5",      text: "text-black/70",  border: "border-black/20" },
}

export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
