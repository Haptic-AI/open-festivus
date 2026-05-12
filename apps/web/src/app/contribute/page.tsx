import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { AREAS, fetchTasks, type ITask, type TaskArea } from "./fetch-tasks"
import { PreviewDrawer } from "./preview-drawer"
import { TasksView, type TasksViewName } from "./tasks-view"

export const metadata: Metadata = {
  title: "Contribute | Festivus",
  description:
    "Pick an area, do a task, open a PR, get credit. Festivus's open contribution queue — humans and agents welcome.",
}

export const revalidate = 60

interface IPageProps {
  searchParams: Promise<{ area?: string; view?: string; preview?: string }>
}

function parseArea(raw: string | undefined): TaskArea | null {
  if (raw === undefined) return null
  const area = raw.toLowerCase()
  return AREAS.includes(area as TaskArea) ? (area as TaskArea) : null
}

function parseView(raw: string | undefined): TasksViewName {
  if (raw === "flow") return "flow"
  return "browse"
}

function parsePreviewNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const n = parseInt(raw, 10)
  return isNaN(n) ? null : n
}

function findTaskByNumber(open: ITask[], inProgress: ITask[], n: number): ITask | null {
  return open.find((t) => t.number === n) ?? inProgress.find((t) => t.number === n) ?? null
}

function buildCloseHref(viewName: TasksViewName, area: TaskArea | null): string {
  const params = new URLSearchParams()
  if (viewName === "flow") params.set("view", "flow")
  if (area !== null) params.set("area", area)
  const qs = params.toString()
  return qs === "" ? "/contribute" : `/contribute?${qs}`
}

export default async function TasksPage({ searchParams }: IPageProps) {
  const params = await searchParams
  const areaFilter = parseArea(params.area)
  const viewName = parseView(params.view)
  const previewNumber = parsePreviewNumber(params.preview)
  const data = await fetchTasks()

  const previewTask =
    previewNumber !== null
      ? findTaskByNumber(data.open, data.inProgress, previewNumber)
      : null
  const closeHref = buildCloseHref(viewName, areaFilter)

  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
        <TasksView {...data} areaFilter={areaFilter} viewName={viewName} />
      </div>
      {previewTask !== null ? (
        <PreviewDrawer closeHref={closeHref} task={previewTask} />
      ) : null}
    </main>
  )
}
