/**
 * GitHub-backed fetcher for the /tasks page.
 *
 * ⚠️ Currently NOT imported by page.tsx. The page reads from
 * `tasks-seed.json` for UI-iteration speed (no auth, no rate limits,
 * instant edits). When the contribution flow is real, swap `fetch-tasks.ts`
 * back to import `fetchTasksFromGithub` from this file.
 *
 * v0 definitions used here:
 *   open       = Issue, label=task, state=open, no assignees
 *   inProgress = Issue, label=task, state=open, has assignee(s)
 *   merged     = PR, state=closed, merged_at within last 7 days, any label
 *
 * Does NOT cross-reference Issues ↔ linked PRs yet (GraphQL query for later).
 */

import "server-only"

import type {
  IAreaCounts,
  IFetchTasksResult,
  IMergedPR,
  ITask,
  TaskArea,
  TaskDifficulty,
  TaskKind,
  TaskNeeds,
} from "./fetch-tasks-types"
import { AREAS } from "./fetch-tasks-types"

const REPO_OWNER = "Haptic-AI"
const REPO_NAME = "open-festivus"

interface IGitHubLabel {
  name: string
}

interface IGitHubUser {
  login: string
}

interface IGitHubIssue {
  number: number
  title: string
  body: string | null
  html_url: string
  state: "open" | "closed"
  assignees: IGitHubUser[]
  user: IGitHubUser | null
  labels: IGitHubLabel[]
  created_at: string
  pull_request?: unknown
}

interface IGitHubPullRequest {
  number: number
  title: string
  html_url: string
  merged_at: string | null
  user: IGitHubUser | null
  labels: IGitHubLabel[]
}

async function gh<T>(path: string): Promise<T> {
  const token = process.env["FESTIVUS_GITHUB_TOKEN"]
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "festivus-web",
  }
  if (token !== undefined && token !== "") {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`https://api.github.com${path}`, {
    headers,
    next: { revalidate: 60 },
  })

  if (!res.ok) {
    throw new Error(`GitHub API ${path} → ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

function extractArea(labels: IGitHubLabel[]): TaskArea | null {
  for (const label of labels) {
    for (const area of AREAS) {
      if (label.name === `area:${area}`) return area
    }
  }
  return null
}

function extractKind(labels: IGitHubLabel[]): TaskKind | null {
  const kindLabels: TaskKind[] = ["compute", "hygiene", "structural", "editorial", "discovery"]
  for (const label of labels) {
    for (const kind of kindLabels) {
      if (label.name === `kind:${kind}`) return kind
    }
  }
  return null
}

function extractNeeds(labels: IGitHubLabel[]): TaskNeeds | null {
  const needsLabels: TaskNeeds[] = ["sim-hardware", "web", "none"]
  for (const label of labels) {
    for (const needs of needsLabels) {
      if (label.name === `needs:${needs}`) return needs
    }
  }
  return null
}

function extractDifficulty(labels: IGitHubLabel[]): TaskDifficulty | null {
  for (const label of labels) {
    if (label.name === "difficulty:easy") return "easy"
    if (label.name === "difficulty:medium") return "medium"
    if (label.name === "difficulty:hard") return "hard"
  }
  return null
}

function makeExcerpt(body: string | null, maxChars = 200): string {
  if (body === null || body === "") return ""
  const cleaned = body.replace(/\r\n/g, "\n").trim()
  const firstParagraph = cleaned.split("\n\n")[0] ?? cleaned
  if (firstParagraph.length <= maxChars) return firstParagraph
  return `${firstParagraph.slice(0, maxChars)}…`
}

function issueToTask(issue: IGitHubIssue): ITask {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body ?? "",
    bodyExcerpt: makeExcerpt(issue.body),
    url: issue.html_url,
    area: extractArea(issue.labels),
    kind: extractKind(issue.labels),
    needs: extractNeeds(issue.labels),
    difficulty: extractDifficulty(issue.labels),
    assignees: issue.assignees.map((a) => a.login),
    createdAt: issue.created_at,
    labels: issue.labels.map((l) => l.name),
  }
}

function prToMerged(pr: IGitHubPullRequest): IMergedPR | null {
  if (pr.merged_at === null) return null
  return {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    mergedAt: pr.merged_at,
    author: pr.user?.login ?? "unknown",
    lane: extractArea(pr.labels),
  }
}

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

export async function fetchTasksFromGithub(): Promise<IFetchTasksResult> {
  const repoUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}`
  const newTaskUrl = `${repoUrl}/issues/new?template=task.yml`

  try {
    const issues = await gh<IGitHubIssue[]>(
      `/repos/${REPO_OWNER}/${REPO_NAME}/issues?labels=task&state=open&per_page=50`,
    )

    const tasksOnly = issues.filter((i) => i.pull_request === undefined)
    const open = tasksOnly.filter((i) => i.assignees.length === 0).map(issueToTask)
    const inProgress = tasksOnly.filter((i) => i.assignees.length > 0).map(issueToTask)
    const openCountsByArea = countByArea(open)

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const recentPRs = await gh<IGitHubPullRequest[]>(
      `/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=closed&sort=updated&direction=desc&per_page=30`,
    )
    const merged = recentPRs
      .map(prToMerged)
      .filter((pr): pr is IMergedPR => pr !== null && pr.mergedAt >= sevenDaysAgo)
      .slice(0, 10)

    return { open, inProgress, merged, openCountsByArea, error: null, repoUrl, newTaskUrl }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      open: [],
      inProgress: [],
      merged: [],
      openCountsByArea: emptyAreaCounts(),
      error: message,
      repoUrl,
      newTaskUrl,
    }
  }
}
