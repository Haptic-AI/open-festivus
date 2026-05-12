"use client"

import { Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"

/**
 * Copy-to-clipboard prompt block.
 *
 * UX patterns (as of 2026):
 *  - Whole block is clickable for easy mobile tap.
 *  - Explicit Copy button in the top-right for discoverability.
 *  - Success state: 'Copied' + check icon, reverts after 2s.
 *  - aria-live="polite" announces the copy state to screen readers.
 *  - Graceful fallback when clipboard API is unavailable.
 */
export function CopyPrompt({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const handleCopy = async () => {
    const selection = typeof window === "undefined" ? null : window.getSelection()
    if (selection !== null && selection.toString().length > 0) return
    try {
      if (navigator.clipboard === undefined) {
        setCopied(false)
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
      className={`group relative block w-full rounded-lg p-6 text-left transition-all md:p-7 ${
        copied
          ? "bg-[#0f2445] ring-2 ring-[#0e8a16]/60"
          : "bg-blueprint-navy hover:bg-[#0f2445] ring-1 ring-transparent hover:ring-safety-yellow/30"
      }`}
      onClick={handleCopy}
      type="button"
    >
      <p className="text-safety-yellow selection:bg-safety-yellow selection:text-blueprint-navy pr-20 font-mono text-base leading-relaxed md:text-lg [user-select:text]">
        &ldquo;{text}&rdquo;
      </p>

      {/* Copy button in top-right corner */}
      <span
        aria-hidden="true"
        className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[13px] font-bold uppercase tracking-wider transition-colors ${
          copied
            ? "bg-[#0e8a16]/20 text-[#7bd389]"
            : "text-drafting-cream/50 group-hover:bg-drafting-cream/10 group-hover:text-drafting-cream"
        }`}
      >
        {copied ? (
          <>
            <Check size={12} strokeWidth={2.5} />
            Copied
          </>
        ) : (
          <>
            <Copy size={12} strokeWidth={2} />
            Copy
          </>
        )}
      </span>

      {/* Screen-reader-only live region */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  )
}
