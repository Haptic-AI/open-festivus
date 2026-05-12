"use client"

import { SignInButton } from "@clerk/nextjs"

interface ISaveNudgeProps {
  blueprintMode: boolean
  onDismiss: () => void
  visible: boolean
}

export function SaveNudge({ blueprintMode, onDismiss, visible }: ISaveNudgeProps) {
  if (!visible) return null

  const cardBg = blueprintMode ? "bg-[#1a2a45] border-safety-yellow/40" : "bg-white border-blueprint-navy/15"
  const text = blueprintMode ? "text-drafting-cream" : "text-blueprint-navy"
  const subtext = blueprintMode ? "text-drafting-cream/60" : "text-blueprint-navy/50"
  const btnBg = blueprintMode ? "bg-safety-yellow text-blueprint-navy hover:bg-safety-yellow/90" : "bg-blueprint-navy text-drafting-cream hover:bg-blueprint-navy/90"

  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 z-50 flex justify-center">
      <div className={`${cardBg} pointer-events-auto flex items-center gap-4 rounded-lg border px-5 py-3 shadow-lg`}>
        <div>
          <p className={`${text} text-sm font-medium`}>Your work is not saved</p>
          <p className={`${subtext} text-xs`}>Sign in to keep your projects across devices</p>
        </div>
        <SignInButton mode="redirect">
          <button
            className={`${btnBg} cursor-pointer rounded px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors`}
            type="button"
          >
            Sign in
          </button>
        </SignInButton>
        <button
          className={`${subtext} cursor-pointer text-lg leading-none transition-opacity hover:opacity-60`}
          onClick={onDismiss}
          type="button"
        >
          x
        </button>
      </div>
    </div>
  )
}
