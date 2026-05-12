/**
 * Shared types for the /tasks page.
 *
 * Imported by both `fetch-tasks.ts` (JSON-backed, currently wired up)
 * and `fetch-tasks-github.ts` (GitHub-backed, dormant until we flip).
 */

export type TaskArea =
  | "robots"
  | "policies"
  | "simulations"
  | "datasets"
  | "papers"
  | "platform"

export type TaskKind = "compute" | "hygiene" | "structural" | "editorial" | "discovery"
export type TaskNeeds = "sim-hardware" | "web" | "none"
export type TaskDifficulty = "easy" | "medium" | "hard"

export const AREAS: TaskArea[] = [
  "robots",
  "policies",
  "simulations",
  "datasets",
  "papers",
  "platform",
]

export interface ITask {
  number: number
  title: string
  body: string
  bodyExcerpt: string
  url: string
  area: TaskArea | null
  kind: TaskKind | null
  needs: TaskNeeds | null
  difficulty: TaskDifficulty | null
  assignees: string[]
  createdAt: string
  labels: string[]
  /**
   * Deep link into the record this task is about — e.g.
   * `/data/robots/franka-research-3` or
   * `/data/compatibility/franka-research-3__lerobot-pi0fast-base`.
   *
   * Optional so the GitHub-Issue fetcher path (which has no record context)
   * still typechecks. When present, the drawer renders an
   * `Open the record →` button instead of a "Claim on GitHub" button.
   */
  record_url?: string
  /** Human-readable name of the record, shown in the drawer next to the URL. */
  record_label?: string
  /**
   * Short, specific instructions for this task — overrides the generic
   * "What done looks like" template body when present. One short paragraph
   * is the goal.
   */
  instructions?: string
}

export type IAreaCounts = Record<TaskArea, number>

export interface IMergedPR {
  number: number
  title: string
  url: string
  mergedAt: string
  author: string
  lane: TaskArea | null
}

export interface IFetchTasksResult {
  open: ITask[]
  inProgress: ITask[]
  merged: IMergedPR[]
  openCountsByArea: IAreaCounts
  error: string | null
  repoUrl: string
  newTaskUrl: string
}
