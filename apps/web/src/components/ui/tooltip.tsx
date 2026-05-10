"use client"

import { useEffect, useId, useRef, useState } from "react"

interface ITooltipProps {
  /** The trigger text shown inline (typically a jargon term). */
  label: string
  /** The explanation shown in the tooltip panel. */
  children: React.ReactNode
  /** Optional className applied to the trigger button. */
  className?: string
}

export function Tooltip({ label, children, className }: ITooltipProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      ref={wrapperRef}
    >
      <button
        aria-describedby={open ? tooltipId : undefined}
        className={`border-blueprint-navy/40 hover:border-safety-yellow focus-visible:ring-safety-yellow inline-flex cursor-help items-baseline border-b border-dotted underline-offset-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${className ?? ""}`}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault()
          setOpen((v) => !v)
        }}
        onFocus={() => setOpen(true)}
        type="button"
      >
        {label}
      </button>
      {open ? (
        <span
          className="bg-blueprint-navy text-drafting-cream pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-md p-3 text-left text-sm font-normal leading-snug normal-case tracking-normal shadow-lg"
          id={tooltipId}
          role="tooltip"
        >
          <span
            aria-hidden
            className="bg-blueprint-navy absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45"
          />
          {children}
        </span>
      ) : null}
    </span>
  )
}
