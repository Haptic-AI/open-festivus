import type { Metadata } from "next"
import { Suspense } from "react"
import { WorkbenchCanvas } from "./workbench-canvas"

export const metadata: Metadata = {
  title: "Workbench | Festivus",
  description: "Build your robotics project on a visual canvas with an AI agent guide.",
}

export default function WorkbenchPage() {
  return (
    <Suspense>
      <WorkbenchCanvas />
    </Suspense>
  )
}
