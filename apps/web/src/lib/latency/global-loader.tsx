"use client"

import { useEffect, useState } from "react"
import { LATENCY_THRESHOLD_MS } from "./use-tracked-action"

export const GLOBAL_LOADER_SHOW = "festivus:global-loader-show"
export const GLOBAL_LOADER_HIDE = "festivus:global-loader-hide"

export interface IGlobalLoaderShowDetail {
  label: string
  thresholdMs?: number
}

// Mounts at the root of the app. Listens for show/hide events. Used
// sparingly — only navigation and full-canvas mutations. Per-button
// work should use <TrackedButton> instead so the click target stays
// anchored.
export function GlobalLoader() {
  const [visible, setVisible] = useState(false)
  const [label, setLabel] = useState<string>("")

  useEffect(() => {
    let pendingTimer: ReturnType<typeof setTimeout> | null = null
    let pendingLabel = ""

    function onShow(e: Event) {
      const detail = (e as CustomEvent<IGlobalLoaderShowDetail>).detail
      const threshold = detail.thresholdMs ?? LATENCY_THRESHOLD_MS
      pendingLabel = detail.label
      if (pendingTimer !== null) clearTimeout(pendingTimer)
      pendingTimer = setTimeout(() => {
        setLabel(pendingLabel)
        setVisible(true)
      }, threshold)
    }
    function onHide() {
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer)
        pendingTimer = null
      }
      setVisible(false)
    }

    window.addEventListener(GLOBAL_LOADER_SHOW, onShow)
    window.addEventListener(GLOBAL_LOADER_HIDE, onHide)
    return () => {
      window.removeEventListener(GLOBAL_LOADER_SHOW, onShow)
      window.removeEventListener(GLOBAL_LOADER_HIDE, onHide)
      if (pendingTimer !== null) clearTimeout(pendingTimer)
    }
  }, [])

  if (!visible) return null
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className="bg-blueprint-navy/30 pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      role="status"
    >
      <span className="loader" />
    </div>
  )
}

// Helper for navigation / full-canvas mutations. Wraps an async function
// with show/hide events. The loader only paints if the work is still
// running at the threshold.
export async function withGlobalLoader<TResult>(
  label: string,
  fn: () => Promise<TResult>,
  thresholdMs?: number,
): Promise<TResult> {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<IGlobalLoaderShowDetail>(GLOBAL_LOADER_SHOW, {
        detail: { label, thresholdMs },
      }),
    )
  }
  try {
    return await fn()
  } finally {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(GLOBAL_LOADER_HIDE))
    }
  }
}
