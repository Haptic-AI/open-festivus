"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { createContext, useCallback, useContext } from "react"

interface IRobotSelectionContext {
  selectedSlugs: Set<string>
  toggleRobot: (slug: string) => void
  clearSelection: () => void
  hasSelection: boolean
}

const RobotSelectionContext = createContext<IRobotSelectionContext>({
  selectedSlugs: new Set(),
  toggleRobot: () => undefined,
  clearSelection: () => undefined,
  hasSelection: false,
})

export function useRobotSelection() {
  return useContext(RobotSelectionContext)
}

export function RobotSelectionProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const robotParams = searchParams.getAll("robot")
  const selectedSlugs = new Set(robotParams.filter((s) => s.length > 0))
  const hasSelection = selectedSlugs.size > 0

  const toggleRobot = useCallback((slug: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const current = params.getAll("robot")
    if (current.includes(slug)) {
      params.delete("robot")
      current.filter((r) => r !== slug).forEach((r) => params.append("robot", r))
    } else {
      params.append("robot", slug)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  const clearSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("robot")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  return (
    <RobotSelectionContext value={{ selectedSlugs, toggleRobot, clearSelection, hasSelection }}>
      {children}
    </RobotSelectionContext>
  )
}
