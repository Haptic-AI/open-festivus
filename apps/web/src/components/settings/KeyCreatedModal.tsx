"use client"

import { useState } from "react"

interface IKeyCreatedModalProps {
  plaintext: string
  onClose: () => void
}

/**
 * Blocking one-time plaintext modal (G10, spec 016).
 *
 * The plaintext key is shown to the user exactly once. A page refresh or
 * browser close means the key is lost — so the UI MUST make "copy now" the
 * visually dominant action, and the modal MUST NOT dismiss on outside-click
 * or escape. Only an explicit "I've copied it" button closes it.
 */
export function KeyCreatedModal({ plaintext, onClose }: IKeyCreatedModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(plaintext)
      setCopied(true)
    } catch {
      // If clipboard fails, the plaintext is still visible in the input.
      setCopied(false)
    }
  }

  return (
    <div
      aria-labelledby="key-created-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
    >
      <div className="max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-neutral-900" id="key-created-title">
          Key created. Copy it now.
        </h2>
        <p className="mt-2 text-sm text-neutral-700">
          You will not see this key again. If you lose it, you will need to revoke it and create a new one.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded border border-neutral-300 bg-neutral-50 p-3">
          <code
            className="flex-1 break-all font-mono text-sm text-neutral-900"
            data-testid="plaintext-key"
          >
            {plaintext}
          </code>
          <button
            className="rounded bg-blueprint-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-blueprint-navy/90"
            data-testid="copy-button"
            onClick={handleCopy}
            type="button"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            data-testid="dismiss-button"
            onClick={onClose}
            type="button"
          >
            I have copied it, close
          </button>
        </div>
      </div>
    </div>
  )
}
