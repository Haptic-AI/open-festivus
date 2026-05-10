"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export const LATENCY_THRESHOLD_MS = 200

export interface ITrackedActionOptions {
  thresholdMs?: number
  onComplete?: (durationMs: number) => void
}

export interface ITrackedActionResult<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult>
  isPending: boolean
  isSlow: boolean
  durationMs: number | null
}

export interface ILatencyEventDetail {
  label: string
  durationMs: number
  thresholdMs: number
  exceeded: boolean
}

export const LATENCY_EVENT = "festivus:latency"

// Wrap any async handler so we measure its latency, expose an `isSlow`
// flag once it crosses the threshold (default 200ms), and emit a
// performance.measure entry + CustomEvent for downstream telemetry.
export function useTrackedAction<TArgs extends unknown[], TResult>(
  label: string,
  fn: (...args: TArgs) => Promise<TResult> | TResult,
  options?: ITrackedActionOptions,
): ITrackedActionResult<TArgs, TResult> {
  const [isPending, setIsPending] = useState(false)
  const [isSlow, setIsSlow] = useState(false)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thresholdMs = options?.thresholdMs ?? LATENCY_THRESHOLD_MS
  const onCompleteRef = useRef(options?.onComplete)
  onCompleteRef.current = options?.onComplete

  useEffect(() => {
    return () => {
      if (slowTimerRef.current !== null) clearTimeout(slowTimerRef.current)
    }
  }, [])

  const run = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      const startMark = `festivus.${label}.start.${performance.now()}`
      const measureName = `festivus.${label}`
      performance.mark(startMark)
      const start = performance.now()
      setIsPending(true)
      setIsSlow(false)
      slowTimerRef.current = setTimeout(() => setIsSlow(true), thresholdMs)
      try {
        return await fn(...args)
      } finally {
        if (slowTimerRef.current !== null) {
          clearTimeout(slowTimerRef.current)
          slowTimerRef.current = null
        }
        const dur = performance.now() - start
        try {
          performance.measure(measureName, startMark)
        } catch {
          // Ignore — mark may have been cleared by another tab.
        }
        setDurationMs(dur)
        setIsPending(false)
        setIsSlow(false)
        const exceeded = dur > thresholdMs
        const detail: ILatencyEventDetail = { label, durationMs: dur, thresholdMs, exceeded }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(LATENCY_EVENT, { detail }))
        }
        if (exceeded) {
          // Console.warn is allowed by eslint; fast actions don't log.
          console.warn(`[latency] slow action "${label}": ${Math.round(dur)}ms (threshold ${thresholdMs}ms)`)
        }
        onCompleteRef.current?.(dur)
      }
    },
    [fn, label, thresholdMs],
  )

  return { run, isPending, isSlow, durationMs }
}
