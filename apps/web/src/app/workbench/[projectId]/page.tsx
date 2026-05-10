import { Suspense } from "react"
import { WorkbenchCanvas } from "../workbench-canvas"

export default async function WorkbenchProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  return (
    <Suspense>
      <WorkbenchCanvas projectId={projectId} />
    </Suspense>
  )
}
