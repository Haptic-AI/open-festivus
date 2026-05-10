"use client"

import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react"
import { useTrackedAction } from "./use-tracked-action"

export interface ITrackedButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  label: string
  onClick?: (e: MouseEvent<HTMLButtonElement>) => Promise<unknown> | void
  thresholdMs?: number
  loaderClassName?: string
  children?: ReactNode
}

// Drop-in <button> replacement that times its onClick handler. If the
// handler hasn't resolved by the threshold (default 200ms) the button
// content is hidden and the dot-pulse loader appears in its place. The
// button keeps its width so layout doesn't shift.
export function TrackedButton({
  children,
  className,
  disabled,
  label,
  loaderClassName,
  onClick,
  thresholdMs,
  ...rest
}: ITrackedButtonProps) {
  const { isPending, isSlow, run } = useTrackedAction<
    [MouseEvent<HTMLButtonElement>],
    unknown
  >(
    label,
    async (e) => {
      const result = onClick?.(e)
      if (result instanceof Promise) await result
    },
    { thresholdMs },
  )

  return (
    <button
      className={`relative ${className ?? ""}`}
      disabled={disabled === true || isPending}
      onClick={(e) => {
        void run(e)
      }}
      type="button"
      {...rest}
    >
      <span className={isSlow ? "invisible" : "visible"}>{children}</span>
      {isSlow ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className={`loader-sm ${loaderClassName ?? ""}`} />
        </span>
      ) : null}
    </button>
  )
}
