/**
 * Seed-backed fetcher for the /tasks page.
 *
 * Reads from `apps/web/src/data/tasks-seed.json` — a flat JSON file
 * of tasks and merged PRs. This is the "UI-iteration mode": no network,
 * no auth, instant edit-refresh, so we can keep discovering the /contribute
 * UX without the overhead of real GitHub Issues.
 *
 * When the contribution flow is ready to go live:
 *   - swap the body of fetchTasks() below to call fetchTasksFromGithub()
 *     from ./fetch-tasks-github.ts
 *   - set FESTIVUS_GITHUB_TOKEN in the relevant env
 *   - done
 *
 * The shape returned here is identical to what the GitHub path returns,
 * so nothing downstream (tasks-view.tsx, page.tsx) needs to change when
 * we flip.
 */

import "server-only"

import seed from "@/data/tasks-seed.json"
import type {
  IAreaCounts,
  IFetchTasksResult,
  IMergedPR,
  ITask,
} from "./fetch-tasks-types"

export type {
  IAreaCounts,
  IFetchTasksResult,
  IMergedPR,
  ITask,
  TaskArea,
  TaskDifficulty,
  TaskKind,
  TaskNeeds,
} from "./fetch-tasks-types"
export { AREAS } from "./fetch-tasks-types"

const REPO_URL = "https://github.com/Haptic-AI/festivus"
const NEW_TASK_URL = `${REPO_URL}/issues/new?template=task.yml`

function emptyAreaCounts(): IAreaCounts {
  return { robots: 0, policies: 0, simulations: 0, datasets: 0, papers: 0, platform: 0 }
}

function countByArea(tasks: ITask[]): IAreaCounts {
  const counts = emptyAreaCounts()
  for (const task of tasks) {
    if (task.area !== null) counts[task.area] += 1
  }
  return counts
}

interface ISeedShape {
  open: ITask[]
  inProgress: ITask[]
  merged: IMergedPR[]
}

export async function fetchTasks(): Promise<IFetchTasksResult> {
  const typed = seed as unknown as ISeedShape
  const open = typed.open
  const inProgress = typed.inProgress
  const merged = typed.merged

  return {
    open,
    inProgress,
    merged,
    openCountsByArea: countByArea(open),
    error: null,
    repoUrl: REPO_URL,
    newTaskUrl: NEW_TASK_URL,
  }
}
