"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { nanoid } from "nanoid"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from "react"
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection as RFConnection,
  type ReactFlowInstance,
  useNodesState,
  useEdgesState,
  type NodeProps,
  BackgroundVariant,
  MarkerType,
  addEdge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { EnvironmentViewer } from "./environment-viewer"
import { computeCompatibility, normalizeSuccessRate } from "@/lib/workbench/compatibility"
import type { ICompatScore } from "@/lib/workbench/compatibility"
import { reliabilityTier } from "@/lib/schemas/domain"
import {
  type ILaneOption,
  EDGE_COLORS,
  LIGHT_THEME,
  DARK_THEME,
  LANE_STYLES,
  DEFAULT_LANE,
  LANE_STYLES_DARK,
  DEFAULT_LANE_DARK,
} from "./canvas-theme"
import {
  type ICanvasStatus,
  type IAskUser,
  SPECIALIST_COLORS,
  ROSTER,
  BullpenBar,
  NodeImage,
  DeploymentNodeComponent,
  StandaloneNodeComponent,
} from "./canvas-nodes"
import { HardwareCard, PolicyCard, EnvironmentCard } from "./lane-cards"
import { ConfirmationCard } from "@/lib/edit-primitives/ConfirmationCard"
import { AskAIDiscoveryToast } from "@/components/agent-chat/AskAIDiscoveryToast"
import { SignInButton } from "@clerk/nextjs"
import { UserButtonWithApiKeys } from "@/components/user-button-with-api-keys"
import { SaveNudge } from "@/components/save-nudge"
import { ProjectDrawer } from "@/components/workbench/project-gallery"
import { cleanStreamingText, isToolText, containsLeakedToolJson } from "@/lib/workbench/sse-filters"
import { GLOBAL_LOADER_HIDE, GLOBAL_LOADER_SHOW, type IGlobalLoaderShowDetail } from "@/lib/latency"
import { useProjectPersistence } from "@/lib/workbench/hooks/use-project-persistence"
import { useAuthStore } from "@/lib/workbench/hooks/use-auth-store"
import { useMigration } from "@/lib/workbench/hooks/use-migration"
import type { ICanvasNode, IConnection, IAgentApiCall, IAgentMessage, ITrayItem, ISnapshot, IPersistedWorkbenchState } from "@festivus/types"

// ── Exploration Lane Node (container with compact cards) ────────────
// LANE_STYLES, DEFAULT_LANE, and ILaneOption moved to ./canvas-theme.ts


function ExplorationLaneComponent({ data }: NodeProps) {
  const d = data as {
    label: string
    options: ILaneOption[]
    scouting: boolean
    scoutingText: string
    onSelect: (id: string) => void
    onRemove: (id: string) => void
    onCardClick: (id: string) => void
    isDark: boolean
  }

  const laneType = d.options[0]?.nodeType ?? ""
  const ls = d.isDark ? (LANE_STYLES_DARK[laneType] ?? DEFAULT_LANE_DARK) : (LANE_STYLES[laneType] ?? DEFAULT_LANE)

  // PM 2.3: pointer from selected card's right edge to the lane's outgoing
  // Handle at (laneWidth, laneHeight/2). Measured post-render so card height
  // changes (expand, compat sort) stay in sync.
  const containerRef = useRef<HTMLDivElement>(null)
  const [pointer, setPointer] = useState<
    | null
    | { cardRight: number; cardMid: number; laneRight: number; laneMid: number; color: string }
  >(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (container === null) { setPointer(null); return }
    const selectedIdx = d.options.findIndex((o) => o.selected)
    if (selectedIdx === -1) { setPointer(null); return }
    const wrappers = container.querySelectorAll<HTMLElement>("[data-lane-card-index]")
    const wrapper = wrappers[selectedIdx]
    if (wrapper === undefined) { setPointer(null); return }
    const cRect = container.getBoundingClientRect()
    const wRect = wrapper.getBoundingClientRect()
    const cardRight = wRect.right - cRect.left
    const cardMid = wRect.top - cRect.top + wRect.height / 2
    const laneRight = cRect.width
    const laneMid = cRect.height / 2
    const selectedOpt = d.options[selectedIdx]
    const color = selectedOpt?.compat?.color ?? ls.border
    setPointer({ cardRight, cardMid, laneRight, laneMid, color })
  }, [d.options, ls.border])

  return (
    <div
      className="rounded-xl"
      ref={containerRef}
      style={{ border: `1px solid ${ls.border}`, backgroundColor: ls.bg, width: 340, padding: 16, position: "relative" }}
    >
      <Handle className="!bg-transparent !border-0 !w-0 !h-0" position={Position.Left} type="target" />
      <Handle className="!bg-transparent !border-0 !w-0 !h-0" position={Position.Right} type="source" />
      <p className="mb-3 text-sm font-bold uppercase" style={{ letterSpacing: "0.5px", color: ls.label }}>
        {d.label}
      </p>
      <div className="flex flex-col gap-4">
        {d.options.map((opt, idx) => {
          const selectHandler = () => { d.onSelect(opt.id); d.onCardClick(opt.id) }
          let cardEl: ReactElement
          if (opt.nodeType === "robot") {
            cardEl = <HardwareCard onRemove={() => d.onRemove(opt.id)} onSelect={selectHandler} opt={opt} />
          } else if (opt.nodeType === "policy") {
            cardEl = <PolicyCard onRemove={() => d.onRemove(opt.id)} onSelect={selectHandler} opt={opt} />
          } else if (opt.nodeType === "environment") {
            cardEl = <EnvironmentCard onRemove={() => d.onRemove(opt.id)} onSelect={selectHandler} opt={opt} />
          } else {
            cardEl = (
              <div
                className={`group relative cursor-pointer rounded-lg bg-white transition-all ${opt.selected ? "opacity-100" : "opacity-45 hover:opacity-70"}`}
                onClick={selectHandler}
                style={{ border: opt.selected ? "2px solid #3b82f6" : "0.5px solid rgba(11,28,54,0.1)", padding: 12 }}
              >
                <p className="text-blueprint-navy" style={{ fontSize: 14, fontWeight: 500 }}>{opt.name}</p>
                <p className="text-blueprint-navy/70 mt-1" style={{ fontSize: 12 }}>{opt.stat}</p>
              </div>
            )
          }
          return <div data-lane-card-index={idx} data-node-id={opt.id} key={opt.id}>{cardEl}</div>
        })}
        {/* Ghost placeholder while scouting */}
        {d.scouting ? (
          <div className="flex items-center gap-2 rounded-lg" style={{ border: "1px dashed rgba(11,28,54,0.12)", minWidth: 120, padding: 12 }}>
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-purple-500" style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
            <span className="text-blueprint-navy/70 text-xs">{d.scoutingText}</span>
          </div>
        ) : null}
      </div>
      {/* PM 2.3: L-shape pointer from selected card's right edge to the lane's
          outgoing Handle, so cross-lane compat edges read as originating
          from the actually-selected card, not the lane-wrapper midpoint. */}
      {pointer !== null ? (
        <svg
          className="pointer-events-none absolute inset-0"
          style={{ overflow: "visible", zIndex: 5 }}
        >
          <path
            d={`M ${pointer.cardRight} ${pointer.cardMid} L ${pointer.laneRight - 6} ${pointer.cardMid} L ${pointer.laneRight - 6} ${pointer.laneMid} L ${pointer.laneRight} ${pointer.laneMid}`}
            fill="none"
            stroke={pointer.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
        </svg>
      ) : null}
    </div>
  )
}

const nodeTypes: NodeTypes = {
  standaloneNode: StandaloneNodeComponent,
  explorationLane: ExplorationLaneComponent,
  deploymentNode: DeploymentNodeComponent,
}

// ── Auto-position ───────────────────────────────────────────────────

// Column X positions for left-to-right flow: task → hardware → policy → environment
const COLUMN_X = { task: 40, robot: 440, deployment: 440, policy: 840, environment: 1240, other: 440 }
const COLUMN_Y_START = 40

// PDT/PST wall-clock for edit-latency logs. `toLocaleTimeString` with
// `timeZoneName: "short"` yields "09:14:39 PDT"; we splice ms in between
// time and timezone so the output is "09:14:39.123 PDT" in DST and
// "09:14:39.123 PST" in standard time — DST handled by America/Los_Angeles.
function tsNow(): string {
  const d = new Date()
  const ms = String(d.getMilliseconds()).padStart(3, "0")
  const base = d.toLocaleTimeString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  })
  return base.replace(" ", `.${ms} `)
}

// ── Main Workbench ──────────────────────────────────────────────────

export function WorkbenchCanvas({ projectId }: { projectId?: string } = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { store: projectStore, isSignedIn, isLoaded: clerkLoaded } = useAuthStore()
  const { isMigrating } = useMigration(isSignedIn, projectStore)
  const initialPromptSent = useRef(false)
  const [canvasNodes, setCanvasNodes] = useState<ICanvasNode[]>([])
  const [connections, setConnections] = useState<IConnection[]>([])
  const [selectedInGroup, setSelectedInGroup] = useState<Record<string, string>>({})
  // Spec 029 phase 3.6: most-recently-selected canvas node. Posted to
  // /api/agent as the "active page context" so Claude knows which
  // underlying record the user means when they say "fix the weight"
  // or "update the license". Updated in both handleCardClick and
  // handleLaneSelect.
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<string | null>(null)
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [messages, setMessages] = useState<IAgentMessage[]>([])
  const [canvasStatus, setCanvasStatus] = useState<ICanvasStatus | null>(null)
  const lastCanvasStatusRef = useRef<ICanvasStatus | null>(null)
  if (canvasStatus !== null) lastCanvasStatusRef.current = canvasStatus
  const [askUser, setAskUser] = useState<IAskUser | null>(null)
  // Bumps every time askUser.question changes. Used as the React `key` on
  // the chip container + question line so they remount and replay the
  // fade-in / yellow-flash. Without this, swapping options for a new robot
  // is invisible — same shape, same position, just a label swap.
  const [askUserKey, setAskUserKey] = useState(0)
  const lastAskUserQuestionRef = useRef<string | null>(null)
  useEffect(() => {
    if (askUser === null) {
      lastAskUserQuestionRef.current = null
      return
    }
    if (askUser.question !== lastAskUserQuestionRef.current) {
      lastAskUserQuestionRef.current = askUser.question
      setAskUserKey((k) => k + 1)
    }
  }, [askUser])
  const [promptValue, setPromptValue] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [turnProgress, setTurnProgress] = useState<{ current: number; max: number } | null>(null)
  // Spec 029 phase 3.5: when the agent fires propose_edit via the /api/agent
  // SSE stream, we set this state so the floating ConfirmationCard renders.
  // Confirm → sendMessage("yes — apply ... confirmation_token ...").
  // Cancel → clear + system message.
  const [pendingDataEdit, setPendingDataEdit] = useState<
    | null
    | {
        table: string
        slug: string
        field: string
        value: unknown
        reason: string | null
        confirmation_token: string
      }
  >(null)
  const [pendingDataEditBusy, setPendingDataEditBusy] = useState(false)
  const [envViewerNode, setEnvViewerNode] = useState<ICanvasNode | null>(null)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [blueprintMode, setBlueprintMode] = useState(false)
  const theme = blueprintMode ? DARK_THEME : LIGHT_THEME
  // Live compat edges for the currently-selected robot, keyed by policy slug.
  // Populated by a single batch fetch against /api/compat whenever the
  // selected robot changes. Drives the per-card score, the top-right compat
  // badge, and the inter-lane connector label in one coherent path.
  const [liveEdges, setLiveEdges] = useState<Record<string, { success_rate: number | null; tier: number | null }>>({})
  const [tray, setTray] = useState<ITrayItem[]>([])
  const [trayOpen, setTrayOpen] = useState(false)
  const [snapshots, setSnapshots] = useState<ISnapshot[]>([])
  const [activeSpecialists, setActiveSpecialists] = useState<Set<string>>(new Set())
  const [activeStatuses, setActiveStatuses] = useState<Record<string, string>>({})

  // Derive the currently-selected robot slug from canvas state. Mirrors the
  // selection logic inside syncToReactFlow: each hardware lane has a
  // selectedInGroup entry; if absent, the first robot in the lane wins.
  const selectedRobotSlugForFetch = useMemo(() => {
    const groups = new Map<string, ICanvasNode[]>()
    for (const node of canvasNodes) {
      if (node.explorationGroup === undefined) continue
      const g = groups.get(node.explorationGroup) ?? []
      g.push(node)
      groups.set(node.explorationGroup, g)
    }
    for (const [groupName, groupNodes] of groups) {
      if (!groupNodes.some((n) => n.type === "robot")) continue
      const selectedId = selectedInGroup[groupName] ?? groupNodes[0]?.id ?? ""
      const selNode = groupNodes.find((n) => n.id === selectedId)
      const slug = selNode?.data["slug"] as string | undefined
      if (slug !== undefined && slug.length > 0) return slug
    }
    return undefined
  }, [canvasNodes, selectedInGroup])

  // Batch-fetch every compat edge for the selected robot. Populates
  // liveEdges keyed by policy_slug — consumed by PolicyCard (score),
  // the lane-build code (top-right badge via computeCompatibility), and
  // the inter-lane connector label.
  // PM plan 2.2: track compatRefreshing so the UI can show a visible
  // "updating compat…" pill while the fetch is in flight. Without this,
  // the policy scores flip too subtly for the user to notice.
  const [compatRefreshing, setCompatRefreshing] = useState(false)
  useEffect(() => {
    if (selectedRobotSlugForFetch === undefined) { setLiveEdges({}); return }
    let cancelled = false
    setCompatRefreshing(true)
    void (async () => {
      try {
        const res = await fetch(`/api/compat?robot=${encodeURIComponent(selectedRobotSlugForFetch)}&limit=50`)
        if (!res.ok) return
        const body = (await res.json()) as { results?: Array<{ policy_slug: string; source: string; status: string; success_rate: number | null; reliability_tier?: number | null }> }
        if (cancelled) return
        const next: Record<string, { success_rate: number | null; tier: number | null }> = {}
        for (const e of body.results ?? []) {
          const tier = e.reliability_tier ?? reliabilityTier({ source: e.source, status: e.status })
          next[e.policy_slug] = { success_rate: e.success_rate, tier: tier ?? null }
        }
        setLiveEdges(next)
      } catch { /* leave previous map; card still falls back to nodeData */ }
      finally { if (!cancelled) setCompatRefreshing(false) }
    })()
    return () => { cancelled = true }
  }, [selectedRobotSlugForFetch])
  const [bullpenHovered, setBullpenHovered] = useState<string | null>(null)
  const [bullpenPinned, setBullpenPinned] = useState<string | null>(null)
  const [landingHover, setLandingHover] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarMode, setSidebarMode] = useState<"rail" | "normal" | "wide">(() => {
    try {
      const saved = localStorage.getItem("festivus_sidebar_mode")
      if (saved === "rail" || saved === "normal" || saved === "wide") return saved
    } catch {}
    return "normal"
  })
  useEffect(() => {
    try { localStorage.setItem("festivus_sidebar_mode", sidebarMode) } catch {}
  }, [sidebarMode])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault()
        setSidebarMode((m) => (m === "rail" ? "normal" : "rail"))
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])
  const agentPanelRef = useRef<HTMLDivElement>(null)
  const conversationRef = useRef<Array<{ role: string; content: string }>>([])
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null)
  // Anchor a clicked card's screen position across the state update that
  // follows. Without this, expanding/collapsing a card in the bottom of a
  // lane causes the React Flow viewport to feel like it "jumps" — the card
  // resizes underneath the user. We capture the card's bounding rect at
  // click time, then in a useLayoutEffect after commit we re-measure and
  // shift the viewport by the delta so the card stays under the cursor.
  const cardAnchorRef = useRef<{ nodeId: string; top: number; left: number } | null>(null)
  const hydrated = useRef(false)
  const promptCountRef = useRef(0)
  // Spec 029 phase 3.7 (latency-instrumentation, Phase A). Stamps the 4
  // milestones of the data-edit loop so we can pin down which leg is
  // slow. Client-only, console.log-only — no persistence yet. Graduate
  // to a structured trace table when Phase B lands.
  const editLatencyRef = useRef<{ tSend?: number; tEditStart?: number; tPropose?: number; tConfirm?: number; tApply?: number }>({})
  // Spec 029 phase 3.8.2: after propose_edit arrives Claude usually keeps
  // streaming (show_agent_message asking for confirmation). isStreaming
  // is still true when the user clicks Confirm — so a naive sendMessage
  // call gets silently dropped by the `if (isStreaming) return` guard at
  // the top of sendMessage. This ref queues the "yes" until the current
  // stream closes, then an effect below dispatches it.
  const queuedConfirmMessageRef = useRef<string | null>(null)
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try { return sessionStorage.getItem("festivus_nudge_dismissed") === "true" } catch { return false }
  })
  const [promptCount, setPromptCount] = useState(0)
  const [navGuardTarget, setNavGuardTarget] = useState<string | null>(null)

  // ── Persistence ─────────────────────────────────────────────────
  const { initialState, isLoaded, save: persistSave } = useProjectPersistence(projectId, projectStore)

  // Hydrate state from persistence on first load.
  //
  // Only flip `hydrated.current` AFTER we have actual content to copy.
  // If initialState is null (project not found in the current store,
  // or store hasn't resolved to the correct auth-scoped one yet),
  // leave hydrated=false — the effect will re-run when initialState
  // updates. This guards against the race that silently overwrote
  // existing projects with empty state:
  //
  //   1. Clerk not yet loaded → useAuthStore returns localStore.
  //   2. load() from localStorage → null → hydrated prematurely flips true.
  //   3. Clerk loads, store swaps to apiStore, real state loads —
  //      but hydrated is already true, so the real state is NEVER
  //      copied into local state.
  //   4. Auto-save fires with local [] → OVERWRITES Redis.
  // When persistence re-loads (store swapped after Clerk resolves), reset hydrated
  // so the hydration effect fires again with the real state from apiStore.
  useEffect(() => {
    if (!isLoaded) hydrated.current = false
  }, [isLoaded])

  useEffect(() => {
    if (!isLoaded || hydrated.current) return
    // Wait for Clerk before treating null as "genuinely new project".
    // Without this guard, we'd flip hydrated while localStore returned null,
    // then the save effect would overwrite the real row with empty state.
    if (initialState === null && !clerkLoaded) return
    hydrated.current = true
    if (initialState !== null) {
      setCanvasNodes(initialState.canvasNodes)
      setConnections(initialState.connections)
      setMessages(initialState.messages)
      setSnapshots(initialState.snapshots)
      setTray(initialState.tray)
      setSelectedInGroup(initialState.selectedInGroup)
      conversationRef.current = initialState.messages.map((m) => ({
        role: m.role === "agent" ? "assistant" : "user",
        content: m.message,
      }))
    }
  }, [isLoaded, initialState, clerkLoaded])

  // Auto-save persisted fields on change
  useEffect(() => {
    if (!isLoaded || !hydrated.current || projectId === undefined) return
    const state: IPersistedWorkbenchState = {
      version: 1,
      projectId,
      name: canvasNodes.find((n) => n.type === "task")?.data["description"] as string ?? projectId,
      canvasNodes,
      connections,
      messages,
      snapshots,
      tray,
      selectedInGroup,
      createdAt: initialState?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    persistSave(state)
  // isLoaded and initialState?.createdAt are intentionally NOT deps. The save must
  // only fire when canvas CONTENT changes (user actions), not when the load finishes.
  // Including them caused a 0-node save: when isLoaded→true, canvasNodes is still []
  // because setCanvasNodes (called by the hydration effect) hasn't taken effect yet.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, canvasNodes, connections, messages, snapshots, tray, selectedInGroup, persistSave])

  useEffect(() => {
    if (agentPanelRef.current !== null) {
      agentPanelRef.current.scrollTop = agentPanelRef.current.scrollHeight
    }
  }, [messages])

  // Persist blueprint mode preference
  useEffect(() => {
    try { const saved = localStorage.getItem("festivus_blueprint_mode"); if (saved === "true") setBlueprintMode(true) } catch { /* no localStorage */ }
  }, [])
  function toggleBlueprintMode() {
    setBlueprintMode((prev) => {
      const next = !prev
      try { localStorage.setItem("festivus_blueprint_mode", String(next)) } catch { /* no localStorage */ }
      return next
    })
  }

  // Dismiss pinned bullpen tooltip on click-outside
  useEffect(() => {
    if (bullpenPinned === null) return
    const handler = () => setBullpenPinned(null)
    const t = setTimeout(() => document.addEventListener("click", handler), 0)
    return () => { clearTimeout(t); document.removeEventListener("click", handler) }
  }, [bullpenPinned])

  // No auto-fit — let the user control zoom and pan

  // ── beforeunload guard for guests ────────────────────────────
  useEffect(() => {
    if (isSignedIn || canvasNodes.length === 0) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isSignedIn, canvasNodes.length])

  // ── Version snapshots ─────────────────────────────────────────

  const saveSnapshot = useCallback((label: string) => {
    setSnapshots((prev) => {
      const snap: ISnapshot = { label, canvasNodes: [...canvasNodes], connections: [...connections], tray: [...tray], timestamp: Date.now() }
      const next = [...prev, snap]
      return next.length > 20 ? next.slice(-20) : next
    })
  }, [canvasNodes, connections, tray])

  function loadSnapshot(snap: ISnapshot) {
    setCanvasNodes(snap.canvasNodes)
    setConnections(snap.connections)
    setTray(snap.tray)
  }

  // ── Lane selection handlers ───────────────────────────────────

  function handleLaneSelect(groupName: string, nodeId: string) {
    setSelectedInGroup((prev) => ({ ...prev, [groupName]: nodeId }))
    setLastSelectedNodeId(nodeId)
    const node = canvasNodes.find((n) => n.id === nodeId)
    const name = (node?.data["name"] as string | undefined) ?? nodeId
    const nodeType = node?.type ?? "item"
    saveSnapshot(`Selected ${name}`)

    // Robot clicks are BROWSE actions — update selection, edges, scores, and
    // ALWAYS refresh the ask_user chips so the user sees the bottom-right
    // suggestions track the most recently clicked robot. Earlier code skipped
    // this once a policy lane existed, which made the chip block feel frozen
    // (clicking H1 after policies appeared left "Find policies for ..." stale).
    if (nodeType === "robot") {
      setAskUser({
        question: `You selected ${name}. What would you like to do?`,
        options: [
          `Find policies for ${name}`,
          `Tell me more about ${name}`,
          "Compare all robots in detail",
          `See ${name} in simulation`,
          "Find cheaper alternatives",
        ],
      })
      return
    } else if (nodeType === "policy") {
      setAskUser({
        question: `You selected ${name}. What next?`,
        options: [
          `Set up a simulation environment for ${name}`,
          `Show me ${name} benchmarks in detail`,
          "Compare all policies side by side",
          "Go back and try a different robot",
        ],
      })
    } else if (nodeType === "environment") {
      setAskUser({
        question: `You selected ${name}. What next?`,
        options: [
          `Run evaluation in ${name}`,
          `Customize ${name} conditions`,
          "Compare all environments",
          "Try a different policy",
        ],
      })
    } else {
      sendMessage(`Selected: ${name}`)
    }
  }

  function handleLaneRemove(nodeId: string) {
    const node = canvasNodes.find((n) => n.id === nodeId)
    if (node !== undefined) {
      setTray((prev) => [...prev, { node, addedAt: Date.now() }])
      setCanvasNodes((prev) => prev.filter((n) => n.id !== nodeId))
    }
  }

  function handleCardClick(nodeId: string) {
    setLastSelectedNodeId(nodeId)
    const node = canvasNodes.find((n) => n.id === nodeId)
    if (node === undefined) return
    if (node.type === "environment") {
      const pid = projectId ?? "default"
      router.push(`/workbench/${pid}/sim/${node.id}`)
    } else if (node.type === "robot" || node.type === "policy") {
      // Anchor the clicked card's screen position so the post-state-change
      // layout shift doesn't make the viewport feel like it jumped. The
      // useLayoutEffect below reads this ref, re-measures, and offsets
      // the React Flow viewport.
      const el = document.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`)
      if (el !== null) {
        const r = el.getBoundingClientRect()
        cardAnchorRef.current = { nodeId, top: r.top, left: r.left }
      }
      setExpandedCardId((prev) => prev === nodeId ? null : nodeId)
    }
  }

  // ── Sync canvas nodes to React Flow ───────────────────────────

  const syncToReactFlow = useCallback((nodes: ICanvasNode[], conns: IConnection[]) => {
    const groups = new Map<string, ICanvasNode[]>()
    const standalone: ICanvasNode[] = []

    for (const node of nodes) {
      if (node.explorationGroup !== undefined) {
        const g = groups.get(node.explorationGroup) ?? []
        g.push(node)
        groups.set(node.explorationGroup, g)
      } else {
        standalone.push(node)
      }
    }

    const flowNodes: Node[] = []
    // Track Y offset per column for left-to-right layout
    const columnY: Record<string, number> = { task: COLUMN_Y_START, robot: COLUMN_Y_START, policy: COLUMN_Y_START, environment: COLUMN_Y_START, other: COLUMN_Y_START }

    // Standalone nodes — placed in their type's column
    // Deployment nodes go after robot lanes, so defer them
    const deploymentNodes: ICanvasNode[] = []
    for (const node of standalone) {
      if (node.type === "deployment") {
        deploymentNodes.push(node)
        continue
      }
      const col = node.type in COLUMN_X ? node.type : "other"
      const colKey = col as keyof typeof COLUMN_X
      flowNodes.push({
        id: node.id,
        type: "standaloneNode",
        position: { x: COLUMN_X[colKey], y: columnY[col] ?? COLUMN_Y_START },
        data: {
          nodeData: node.data,
          nodeType: node.type,
          nodeStatus: node.status,
          onSelect: node.type === "environment" ? () => setEnvViewerNode(node) : undefined,
          theme,
        },
      })
      columnY[col] = (columnY[col] ?? COLUMN_Y_START) + 200
    }

    // Find selected robot across all robot lanes (for compatibility scoring)
    let selectedRobotSlug: string | undefined
    let selectedRobotName: string | undefined
    let selectedRobotLaneId: string | undefined
    for (const [groupName, groupNodes] of groups) {
      const hasRobots = groupNodes.some((n) => n.type === "robot")
      if (hasRobots) {
        const selId = selectedInGroup[groupName] ?? groupNodes[0]?.id ?? ""
        const selNode = groupNodes.find((n) => n.id === selId)
        if (selNode !== undefined) {
          selectedRobotSlug = (selNode.data["slug"] as string | undefined) ?? undefined
          selectedRobotName = (selNode.data["name"] as string | undefined) ?? selNode.id
          selectedRobotLaneId = `lane-${groupName}`
        }
      }
    }

    // Find selected policy across all policy lanes — needed by env cards to
    // look up the specific (policy × env) simulation, and to POST a fresh
    // one via /api/simulations when none exists. Also capture hf_repo_id
    // so env cards can distinguish runnable policies from closed-source
    // stubs (Helix) and show "Coming Soon" instead of a doomed render.
    let selectedPolicySlug: string | undefined
    let selectedPolicyHfRepoId: string | undefined
    for (const [groupName, groupNodes] of groups) {
      const hasPolicies = groupNodes.some((n) => n.type === "policy")
      if (hasPolicies) {
        const selId = selectedInGroup[groupName] ?? groupNodes[0]?.id ?? ""
        const selNode = groupNodes.find((n) => n.id === selId)
        if (selNode !== undefined) {
          selectedPolicySlug = (selNode.data["slug"] as string | undefined) ?? undefined
          const hfRepoId = selNode.data["hf_repo_id"]
          selectedPolicyHfRepoId = typeof hfRepoId === "string" && hfRepoId.length > 0 ? hfRepoId : undefined
        }
      }
    }

    // Exploration lanes
    const policyLaneIds: string[] = []
    const policyNodeIds: Array<{ nodeId: string; compat: ICompatScore | undefined }> = []

    for (const [groupName, groupNodes] of groups) {
      const selectedId = selectedInGroup[groupName] ?? groupNodes[0]?.id ?? ""
      const hasPolicies = groupNodes.some((n) => n.type === "policy")
      const laneId = `lane-${groupName}`

      const options = groupNodes.map((n) => {
        const nd = n.data
        const name = (nd["name"] as string | undefined) ?? n.id
        const price = nd["price"] as number | undefined
        const dof = nd["dof"] as number | undefined
        const srRaw = nd["success_rate"] as number | undefined
        const sr = srRaw !== undefined ? normalizeSuccessRate(srRaw) : undefined
        const imageUrl = (nd["image_url"] as string | undefined) ?? undefined
        const stat = price !== undefined ? `$${price}${dof !== undefined ? ` · ${dof}-DoF` : ""}`
          : sr !== undefined ? `${sr}% success` : n.type

        // Compute compatibility for policy nodes when a robot is selected.
        // Live edge from /api/compat wins if present — it reflects real
        // tested/reported pairings rather than the policy's self-declared
        // compatible_robot_slugs. Threaded through so opt.compat, the badge,
        // the connector-edge label, and the card score all agree.
        let compat: ICompatScore | undefined
        if (hasPolicies && n.type === "policy" && selectedRobotSlug !== undefined && selectedRobotName !== undefined) {
          const policySlug = nd["slug"] as string | undefined
          const liveEdge = policySlug !== undefined ? liveEdges[policySlug] : undefined
          compat = computeCompatibility(nd, selectedRobotSlug, selectedRobotName, liveEdge)
          policyNodeIds.push({ nodeId: n.id, compat })
        }

        return { id: n.id, name, stat, nodeType: n.type, selected: n.id === selectedId, imageUrl, compat, nodeData: nd, selectedRobotName, selectedRobotSlug, selectedPolicySlug, selectedPolicyHfRepoId, expanded: expandedCardId === n.id, theme }
      })

      // Spec 029 PM plan 2.1: show-all-filter-out for policy lanes. Sort
      // by compat score descending so green cards rise to the top and
      // incompats (score=0) sink. The cards themselves remain rendered —
      // not hidden — so the user can see "these 5 are compatible, these
      // 8 are not" at a glance. Card-level visual de-emphasis for
      // incompat is handled in lane-cards.tsx.
      if (hasPolicies) {
        options.sort((a, b) => {
          const sa = a.compat?.score ?? -1
          const sb = b.compat?.score ?? -1
          return sb - sa
        })
      }

      // Policy lane label: show task x robot context so it's clear what the policies are for
      // Environment lanes are labelled "SIMULATIONS" (they link to simulation episodes, not raw env records)
      // Hardware lanes just show their exploration_group name
      const hasEnvironments = groupNodes.some((n) => n.type === "environment")
      let label = hasEnvironments
        ? groupName.toUpperCase().replace(/^ENVIRONMENTS?/i, "SIMULATIONS")
        : groupName.toUpperCase()
      if (hasPolicies) {
        const taskName = standalone.find((n) => n.type === "task")?.data["name"] as string | undefined
        if (taskName !== undefined) {
          label = `${label} \u2014 ${taskName.toUpperCase()}`
        }
      }
        // PM plan 2.2: visible signal compat scores are refetching after robot click.
        if (compatRefreshing) {
          label = `${label} · UPDATING…`
        }
      if (hasPolicies) policyLaneIds.push(laneId)

      // Place lane in the correct column based on node type
      const primaryType = groupNodes[0]?.type ?? "other"
      const col = primaryType in COLUMN_X ? primaryType : "other"
      const colKey = col as keyof typeof COLUMN_X

      flowNodes.push({
        id: laneId,
        type: "explorationLane",
        position: { x: COLUMN_X[colKey], y: columnY[col] ?? COLUMN_Y_START },
        data: {
          label,
          options,
          scouting: isStreaming && selectedInGroup[groupName] === undefined,
          scoutingText: canvasStatus?.text ?? "Looking for options...",
          onSelect: (id: string) => handleLaneSelect(groupName, id),
          onRemove: (id: string) => handleLaneRemove(id),
          onCardClick: (id: string) => handleCardClick(id),
          isDark: blueprintMode,
        },
      })
      // Estimate lane height: label (40) + cards stacked vertically + gap (16px per gap) + padding (32)
      const cardCount = groupNodes.length
      const hasExpanded = options.some((o) => o.expanded)
      const perCardHeight = primaryType === "robot" ? 280 : primaryType === "policy" ? 280 : 240
      const gapTotal = Math.max(0, cardCount - 1) * 16
      const laneHeight = 72 + cardCount * perCardHeight + gapTotal + (hasExpanded ? 250 : 0)
      columnY[col] = (columnY[col] ?? COLUMN_Y_START) + laneHeight + 60
    }

    // Edges from agent-created connections
    const flowEdges: Edge[] = conns.map((c, i) => ({
      id: `edge-${i}`,
      source: c.fromId,
      target: c.toId,
      animated: c.status === "suggested",
      type: "smoothstep",
      style: { stroke: EDGE_COLORS[c.status] ?? "#A3A7AC", strokeWidth: 2, strokeDasharray: c.status === "suggested" ? "5 5" : undefined },
      markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[c.status] ?? "#A3A7AC" },
      label: c.label,
    }))

    // Deployment nodes — positioned below robot lanes
    for (const node of deploymentNodes) {
      const robotCol = "robot" as keyof typeof COLUMN_X
      flowNodes.push({
        id: node.id,
        type: "deploymentNode",
        position: { x: COLUMN_X[robotCol], y: columnY["robot"] ?? COLUMN_Y_START },
        data: {
          nodeData: node.data,
          nodeStatus: node.status,
          theme,
          expanded: expandedCardId === node.id,
          onToggleExpand: () => setExpandedCardId((prev) => prev === node.id ? null : node.id),
        },
      })
      columnY["robot"] = (columnY["robot"] ?? COLUMN_Y_START) + (expandedCardId === node.id ? 400 : 200)

      // Red dashed edge from robot to deployment node
      const robotRef = node.data["robot_id"] as string | undefined
      if (robotRef !== undefined) {
        flowEdges.push({
          id: `deploy-${node.id}`,
          source: robotRef,
          target: node.id,
          type: "smoothstep",
          style: { stroke: "#D45B5B", strokeWidth: 1.5, strokeDasharray: "6 4" },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#D45B5B" },
        })
      }
    }

    // ── Auto-generated pipeline edges ──────────────────────────────

    // 1. Task node → first robot lane (neutral gray flow arrow)
    const taskNodes = standalone.filter((n) => n.type === "task")
    if (taskNodes.length > 0 && selectedRobotLaneId !== undefined) {
      const taskId = taskNodes[0]?.id
      if (taskId !== undefined) {
        flowEdges.push({
          id: `flow-task-${selectedRobotLaneId}`,
          source: taskId,
          target: selectedRobotLaneId,
          type: "smoothstep",
          style: { stroke: theme.edgeNeutral, strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: theme.edgeNeutral },
        })
      }
    }

    // 2. Robot lane → policy lane (colored by best compatibility score)
    if (selectedRobotLaneId !== undefined && policyLaneIds.length > 0) {
      for (const policyLaneId of policyLaneIds) {
        const lanePolicies = policyNodeIds.filter((p) => {
          const groupName = policyLaneId.replace("lane-", "")
          const gn = groups.get(groupName)
          return gn?.some((n) => n.id === p.nodeId) ?? false
        })
        const bestScore = lanePolicies.reduce<number | null>((best, p) => {
          const s = p.compat?.score ?? 0
          return best === null ? s : Math.max(best, s)
        }, null)
        const allIncompat = lanePolicies.every((p) => p.compat !== undefined && p.compat.score === 0)

        const edgeColor = allIncompat ? theme.edgeRed : bestScore === null ? theme.edgeAmber : bestScore > 75 ? theme.edgeGreen : bestScore >= 40 ? theme.edgeAmber : theme.edgeRed
        const edgeLabel = allIncompat ? "N/A" : bestScore !== null ? `${bestScore}%` : "Untested"
        const isDashed = allIncompat || (bestScore !== null && bestScore < 40)

        flowEdges.push({
          id: `compat-${selectedRobotLaneId}-${policyLaneId}`,
          source: selectedRobotLaneId,
          target: policyLaneId,
          type: "smoothstep",
          animated: !allIncompat && !isDashed,
          style: {
            stroke: edgeColor,
            strokeWidth: bestScore !== null && bestScore > 75 ? 2 : 1.5,
            strokeDasharray: isDashed ? "6 4" : undefined,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
          label: edgeLabel,
          labelStyle: { fill: edgeColor, fontWeight: 700, fontSize: 18 },
          labelBgStyle: { fill: theme.edgeLabelBg, stroke: edgeColor, strokeWidth: 0.5 },
          labelBgPadding: [6, 12] as [number, number],
          labelBgBorderRadius: 4,
        })
      }
    }

    // 3. Policy lane → environment lane (neutral gray for now — no compat data for envs)
    const envLaneIds: string[] = []
    for (const [groupName, groupNodes] of groups) {
      if (groupNodes.some((n) => n.type === "environment")) {
        envLaneIds.push(`lane-${groupName}`)
      }
    }
    if (policyLaneIds.length > 0 && envLaneIds.length > 0) {
      for (const envLaneId of envLaneIds) {
        flowEdges.push({
          id: `flow-policy-${envLaneId}`,
          source: policyLaneIds[0] ?? "",
          target: envLaneId,
          type: "smoothstep",
          style: { stroke: theme.edgeNeutral, strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: theme.edgeNeutral },
        })
      }
    }

    setRfNodes(flowNodes)
    setRfEdges(flowEdges)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRfNodes, setRfEdges, selectedInGroup, isStreaming, expandedCardId, blueprintMode, theme, liveEdges])

  useEffect(() => {
    syncToReactFlow(canvasNodes, connections)
  }, [canvasNodes, connections, syncToReactFlow])

  // Keep the task card (canvas x=40) visible as the agent adds wider
  // content. Without this, ROBOTS lanes (x=440+) and POLICIES (x=840+)
  // pull the user's pan focus rightward and the task card falls off-
  // screen-left — confirmed by user-reported screenshots where "Fold
  // Laundry" was visible at step 5/40 and gone by step 9/40.
  //
  // Guarded so we don't yank the viewport while the user is mid-action:
  // skipped when an expanded card is open (they're reading), when the
  // ReactFlow instance hasn't initialized yet, and when the group count
  // hasn't grown since last fire.
  const prevExplorationGroupCountRef = useRef(0)
  useEffect(() => {
    if (rfInstanceRef.current === null) return
    if (expandedCardId !== null) return
    const groups = new Set<string>()
    for (const n of canvasNodes) {
      if (n.explorationGroup !== undefined) groups.add(n.explorationGroup)
    }
    const count = groups.size
    if (count > prevExplorationGroupCountRef.current) {
      rfInstanceRef.current.fitView({ padding: 0.15, duration: 400, includeHiddenNodes: false })
    }
    prevExplorationGroupCountRef.current = count
  }, [canvasNodes, expandedCardId])

  // After the click-driven layout commits, restore the clicked card's
  // screen position. We re-measure the same DOM element and shift the
  // React Flow viewport by the delta. Without this the user feels like
  // the canvas "jumped" when a card at the bottom of a long lane expands
  // or collapses.
  useLayoutEffect(() => {
    const anchor = cardAnchorRef.current
    if (anchor === null) return
    const el = document.querySelector<HTMLElement>(`[data-node-id="${anchor.nodeId}"]`)
    const inst = rfInstanceRef.current
    if (el === null || inst === null) {
      cardAnchorRef.current = null
      return
    }
    const r = el.getBoundingClientRect()
    const dx = r.left - anchor.left
    const dy = r.top - anchor.top
    cardAnchorRef.current = null
    if (dx === 0 && dy === 0) return
    const vp = inst.getViewport()
    inst.setViewport({ x: vp.x - dx, y: vp.y - dy, zoom: vp.zoom })
  }, [rfNodes])

  // ── Drag-to-connect ───────────────────────────────────────────

  const onConnect = useCallback((params: RFConnection) => {
    if (params.source === null || params.target === null) return
    const newEdge: Edge = {
      id: `edge-connect-${Date.now()}`,
      source: params.source,
      target: params.target,
      style: { stroke: EDGE_COLORS["untested"], strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS["untested"] ?? "#eab308" },
    }
    setRfEdges((eds) => addEdge(newEdge, eds))
    setConnections((prev) => [...prev, { fromId: params.source ?? "", toId: params.target ?? "", status: "untested" }])
    saveSnapshot(`Connected ${params.source} → ${params.target}`)

    const sourceNode = canvasNodes.find((n) => n.id === params.source)
    const targetNode = canvasNodes.find((n) => n.id === params.target)
    const sName = (sourceNode?.data["name"] as string | undefined) ?? params.source
    const tName = (targetNode?.data["name"] as string | undefined) ?? params.target
    sendMessage(`Evaluate connection: ${sName} → ${tName}. Are they compatible?`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasNodes, setRfEdges, saveSnapshot])

  // Pair to startProject's GLOBAL_LOADER_SHOW: once the agent's first tool
  // call drops a node onto the canvas, the user has visible proof the work
  // is happening, so hide the loader. HIDE is idempotent so re-firing on
  // every node growth is safe; we don't bother gating it behind a ref.
  const hasCanvasNodes = canvasNodes.length > 0
  useEffect(() => {
    if (!hasCanvasNodes) return
    if (typeof window === "undefined") return
    window.dispatchEvent(new Event(GLOBAL_LOADER_HIDE))
  }, [hasCanvasNodes])

  // ── Handle tool calls ─────────────────────────────────────────

  const handleToolCall = useCallback((toolName: string, input: Record<string, unknown>) => {
    switch (toolName) {
      case "add_node": {
        const newNode: ICanvasNode = {
          id: input["id"] as string,
          type: input["node_type"] as ICanvasNode["type"],
          data: (input["data"] as Record<string, unknown>) ?? {},
          status: input["exploration_group"] !== undefined ? "exploring" : "idle",
          explorationGroup: input["exploration_group"] as string | undefined,
          positionHint: input["position_hint"] as string | undefined,
        }
        setCanvasNodes((prev) => [...prev.filter((n) => n.id !== newNode.id), newNode])
        break
      }
      case "update_node": {
        const id = input["id"] as string
        setCanvasNodes((prev) => prev.map((n) => n.id !== id ? n : {
          ...n, data: { ...n.data, ...((input["updates"] as Record<string, unknown>) ?? {}) }, status: (input["status"] as string) ?? n.status,
        }))
        break
      }
      case "connect_nodes": {
        setConnections((prev) => [...prev, {
          fromId: input["from_id"] as string, toId: input["to_id"] as string,
          status: (input["status"] as string) ?? "suggested", label: input["label"] as string | undefined,
        }])
        saveSnapshot(`Agent connected ${input["from_id"] as string} → ${input["to_id"] as string}`)
        break
      }
      case "show_agent_message": {
        const specialist = input["specialist"] as string
        const injectedApiCalls = input["__api_calls"]
        const apiCalls = Array.isArray(injectedApiCalls) ? injectedApiCalls as IAgentApiCall[] : undefined
        setMessages((prev) => [...prev, {
          role: "agent", specialist,
          message: input["message"] as string,
          thinking: input["thinking"] as string | undefined,
          ...(apiCalls !== undefined && apiCalls.length > 0 ? { api_calls: apiCalls } : {}),
        }])
        setActiveSpecialists((prev) => new Set([...prev, specialist]))
        // Extract a short status from the message (first sentence or first 30 chars)
        const msg = input["message"] as string
        const shortStatus = msg.length > 40 ? `${msg.slice(0, 37)}...` : msg
        setActiveStatuses((prev) => ({ ...prev, [specialist]: shortStatus }))
        break
      }
      case "set_canvas_status": {
        const statusSpecialist = input["specialist"] as string
        const statusText = input["status_text"] as string
        setCanvasStatus({ nodeId: input["node_id"] as string | undefined, text: statusText, specialist: statusSpecialist })
        setActiveSpecialists((prev) => new Set([...prev, statusSpecialist]))
        setActiveStatuses((prev) => ({ ...prev, [statusSpecialist]: statusText }))
        break
      }
      case "ask_user": {
        setAskUser({ question: input["question"] as string, options: input["options"] as string[] | undefined })
        break
      }
      case "update_recipe": {
        setCanvasNodes((prev) => {
          const existing = prev.find((n) => n.id === "recipe")
          if (existing !== undefined) return prev.map((n) => n.id === "recipe" ? { ...n, data: { ...n.data, ...input } } : n)
          return [...prev, { id: "recipe", type: "results", data: input, status: "idle" }]
        })
        break
      }
    }
  }, [saveSnapshot])

  // ── Restore from tray ─────────────────────────────────────────

  function restoreFromTray(item: ITrayItem) {
    setTray((prev) => prev.filter((t) => t.node.id !== item.node.id))
    setCanvasNodes((prev) => [...prev.filter((n) => n.id !== item.node.id), { ...item.node, status: "idle" }])
    saveSnapshot(`Restored ${(item.node.data["name"] as string | undefined) ?? item.node.id}`)
  }

  // ── Send message ──────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (isStreaming) return
    setIsStreaming(true)
    setTurnProgress(null)
    setAskUser(null)
    setMessages((prev) => [...prev, { role: "user", message: text }])
    conversationRef.current.push({ role: "user", content: text })
    promptCountRef.current += 1
    setPromptCount(promptCountRef.current)

    // Stamp the "user sent a message" milestone. propose_edit will measure
    // from here; subsequent sends overwrite for the next edit loop.
    editLatencyRef.current.tSend = performance.now()
    // eslint-disable-next-line no-console
    console.log(`[${tsNow()}] [edit-latency] START t=0ms — send: "${text.slice(0, 60)}${text.length > 60 ? "..." : ""}"`)

    // Spec 029 phase 3.6: derive the active canvas node's page context so
    // the route can pin {table, slug, recordName} into the system prompt.
    // Maps canvas node_type → patch-allowlist table name. Returns null when
    // the node is a non-editable aggregate (deployment, results, task).
    const activeContext = (() => {
      if (lastSelectedNodeId === null) return null
      const node = canvasNodes.find((n) => n.id === lastSelectedNodeId)
      if (node === undefined) return null
      const nodeType = node.type
      const tableMap: Record<string, string> = {
        robot: "robots",
        policy: "policies",
        dataset: "datasets",
        environment: "environments",
      }
      const table = tableMap[nodeType]
      if (table === undefined) return null
      const data = node.data as Record<string, unknown>
      const slug = typeof data["slug"] === "string" ? (data["slug"] as string) : undefined
      const recordName = typeof data["name"] === "string" ? (data["name"] as string) : slug
      if (slug === undefined || recordName === undefined) return null
      return { table, slug, recordName }
    })()

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          projectState: { nodes: canvasNodes, connections },
          conversationHistory: conversationRef.current.slice(-20).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          context: activeContext,
        }),
      })

      if (!response.ok) {
        setMessages((prev) => [...prev, { role: "agent", specialist: "hardware", message: "Agent couldn't respond. Try again." }])
        setIsStreaming(false)
        return
      }

      const reader = response.body?.getReader()
      if (reader === undefined) { setIsStreaming(false); return }

      const decoder = new TextDecoder()
      let buffer = ""
      const assistantActions: string[] = []
      let streamingTextAcc = ""
      // Most recent batch of api calls — attached to every consecutive
      // show_agent_message until a NEW api_tool_called starts a fresh
      // batch. This way a turn that does 2 searches and then emits 3
      // specialist messages tags all 3 messages with the same 2 URLs,
      // since they were all informed by the same data fetch.
      let currentApiCallSnapshot: IAgentApiCall[] = []
      let nextApiCallStartsNewBatch = true

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const jsonStr = line.slice(6).trim()
          if (jsonStr.length === 0) continue
          try {
            const event = JSON.parse(jsonStr) as {
              type: string
              text?: string
              name?: string
              input?: Record<string, unknown>
              error?: string
              current?: number
              max?: number
              urls?: string[]
              duration_ms?: number
              tool_use_id?: string
              result?: Record<string, unknown>
            }
            if (event.type === "turn_progress" && typeof event.current === "number" && typeof event.max === "number") {
              setTurnProgress({ current: event.current, max: event.max })
            } else if (event.type === "text_delta" && event.text !== undefined) {
              // Incremental text streaming — accumulate but suppress tool-like content
              streamingTextAcc += event.text
              const cleaned = cleanStreamingText(streamingTextAcc)
              if (cleaned.length > 0) {
                setMessages((prev) => {
                  const last = prev[prev.length - 1]
                  if (last !== undefined && last.role === "agent" && last.specialist === "_streaming") {
                    return [...prev.slice(0, -1), { ...last, message: cleaned }]
                  }
                  return [...prev, { role: "agent" as const, specialist: "_streaming", message: cleaned }]
                })
              }
            } else if (event.type === "text" && event.text !== undefined) {
              // Full text block — suppress if it contains tool JSON
              const txt = event.text
              if (!isToolText(txt)) {
                setMessages((prev) => [...prev, { role: "agent", specialist: "hardware", message: txt }])
              }
              assistantActions.push(txt)
            } else if (event.type === "api_tool_called" && event.name !== undefined) {
              // Server-side API tool just fired. If the previous batch
              // was already consumed by a show_agent_message, this call
              // starts a fresh batch. Otherwise it appends to the active
              // batch. Tools that fan out (e.g. find_gaps) surface each
              // URL as its own line.
              if (nextApiCallStartsNewBatch) {
                currentApiCallSnapshot = []
                nextApiCallStartsNewBatch = false
              }
              const urls = event.urls ?? []
              const duration = event.duration_ms ?? 0
              for (const url of urls) {
                currentApiCallSnapshot.push({ name: event.name, url, duration_ms: duration })
              }
            } else if (event.type === "tool_call" && event.name !== undefined) {
              // Clear streaming text — it was tool narration, not user-facing content
              if (streamingTextAcc.length > 0) {
                // Remove the _streaming message since it was just tool preamble
                setMessages((prev) => prev.filter((m) => m.specialist !== "_streaming"))
                assistantActions.push(streamingTextAcc)
                streamingTextAcc = ""
              }
              const toolInput: Record<string, unknown> = { ...((event.input as Record<string, unknown>) ?? {}) }
              if (event.name === "show_agent_message" && currentApiCallSnapshot.length > 0) {
                // Attach a copy of the active batch to this message. The
                // batch stays around for sibling show_agent_messages, but
                // the NEXT api_tool_called will start a fresh one.
                toolInput["__api_calls"] = [...currentApiCallSnapshot]
                nextApiCallStartsNewBatch = true
              }
              handleToolCall(event.name, toolInput)
              assistantActions.push(`[tool:${event.name}]`)
            } else if (event.type === "edit_tool_result" && event.name !== undefined && event.result !== undefined) {
              // Spec 029 phase 3.5. Dispatches the three edit-tool result
              // shapes. Only propose_edit needs UI (the confirmation card);
              // list_candidates renders as a system-line show_agent_message;
              // apply_edit flips back to a success/error message + clears
              // the confirmation state.
              const result = event.result
              if (event.name === "propose_edit" && typeof result["confirmation_token"] === "string") {
                setPendingDataEdit({
                  table: String(result["table"] ?? ""),
                  slug: String(result["slug"] ?? ""),
                  field: String(result["field"] ?? ""),
                  value: result["value"],
                  reason: (result["reason"] as string | null) ?? null,
                  confirmation_token: String(result["confirmation_token"]),
                })
                setPendingDataEditBusy(false)
                // Phase A latency — time from user's send to propose_edit.
                // Pin tEditStart here so the "yes" confirmation's sendMessage
                // call can overwrite tSend without losing the edit-loop start.
                editLatencyRef.current.tPropose = performance.now()
                editLatencyRef.current.tEditStart = editLatencyRef.current.tSend
                if (editLatencyRef.current.tEditStart !== undefined) {
                  // eslint-disable-next-line no-console
                  console.log(`[${tsNow()}] [edit-latency] propose_edit arrived at +${String(Math.round(editLatencyRef.current.tPropose - editLatencyRef.current.tEditStart))}ms`)
                }
              } else if (event.name === "apply_edit") {
                const ok = result["ok"] === true
                const body = result["body"] as Record<string, unknown> | undefined
                const status = result["status"] as number | undefined
                if (ok && body && typeof body["mutation_id"] === "number") {
                  setMessages((prev) => [...prev, { role: "agent", specialist: "community", message: `Edit live. Mutation #${body["mutation_id"]} — a moderator can revert.` }])
                  // Phase A latency — apply_edit landed
                  editLatencyRef.current.tApply = performance.now()
                  const tStart = editLatencyRef.current.tEditStart
                  if (tStart !== undefined) {
                    // eslint-disable-next-line no-console
                    console.log(`[${tsNow()}] [edit-latency] apply_edit ok at +${String(Math.round(editLatencyRef.current.tApply - tStart))}ms`)
                  }
                  // Phase 3.7 bug fix: canvasNodes is client state, so
                  // router.refresh() alone (which reruns server components)
                  // doesn't update the cards on screen. Optimistically merge
                  // the new {field, value} into the matching node's data
                  // by {table → node.type, slug}. Instant UI feedback.
                  const pe = pendingDataEdit
                  if (pe !== null) {
                    const tableToType: Record<string, string> = { robots: "robot", policies: "policy", datasets: "dataset", environments: "environment" }
                    const targetType = tableToType[pe.table]
                    if (targetType !== undefined) {
                      let matched = false
                      setCanvasNodes((prev) => prev.map((n) => {
                        if (n.type !== targetType) return n
                        const data = n.data as Record<string, unknown>
                        if (data["slug"] !== pe.slug) return n
                        matched = true
                        return { ...n, data: { ...data, [pe.field]: pe.value } }
                      }))
                      // If nothing matched, the canvas doesn't currently
                      // hold a node for this edit (e.g., user edited a
                      // record they're viewing on the sidebar but haven't
                      // added to the canvas). That's fine — the edit still
                      // landed server-side. Log it so we can tell apart
                      // "merge happened" from "no canvas node to merge into"
                      // when the UI doesn't visibly change.
                      if (!matched) {
                        // eslint-disable-next-line no-console
                        console.log(`[${tsNow()}] [edit-latency] 3.7 merge: no canvas node matched ${pe.table}/${pe.slug} — edit landed server-side but no card to refresh`)
                      }
                    }
                  }
                  router.refresh()
                  // Phase A latency — END marker with full split
                  const { tEditStart, tPropose, tConfirm, tApply } = editLatencyRef.current
                  if (tEditStart !== undefined && tPropose !== undefined && tConfirm !== undefined && tApply !== undefined) {
                    const legPropose = Math.round(tPropose - tEditStart)
                    const legThink = Math.round(tConfirm - tPropose)
                    const legApply = Math.round(tApply - tConfirm)
                    const total = Math.round(tApply - tEditStart)
                    // eslint-disable-next-line no-console
                    console.log(`[${tsNow()}] [edit-latency] END total=${String(total)}ms (propose=${String(legPropose)} think=${String(legThink)} apply=${String(legApply)})`)
                  }
                  editLatencyRef.current = {}
                } else if (result["error"] === "auth_required") {
                  const msg = typeof result["message"] === "string" ? result["message"] : "Sign in to apply this edit."
                  setMessages((prev) => [...prev, { role: "agent", specialist: "community", message: msg }])
                } else if (status === 429) {
                  setMessages((prev) => [...prev, { role: "agent", specialist: "community", message: "Rate limit hit: 200 edits per 24h. Try again later." }])
                } else if (body?.["error"] === "field_not_agent_editable") {
                  const field = body["field_rejections"] as Array<{ field?: string }> | undefined
                  const fname = field?.[0]?.field ?? "that field"
                  setMessages((prev) => [...prev, { role: "agent", specialist: "community", message: `Cannot edit ${fname} — it's not agent-editable.` }])
                } else {
                  // Show the raw error so we can diagnose unexpected
                  // failure shapes. Keeps the user's chat useful without
                  // needing devtools. Edit-latency logs will show how
                  // far the loop got.
                  const errMsg = typeof result["error"] === "string" ? result["error"] : "unknown"
                  const detail = typeof result["detail"] === "string" ? result["detail"] : JSON.stringify(result).slice(0, 200)
                  console.error(`[${tsNow()}] [edit-latency] apply_edit failed`, result)
                  setMessages((prev) => [...prev, { role: "agent", specialist: "community", message: `Edit failed${status !== undefined ? ` (${String(status)})` : ""}: ${errMsg} — ${detail}` }])
                }
                setPendingDataEdit(null)
                setPendingDataEditBusy(false)
              } else if (event.name === "list_candidates" && typeof result["count"] === "number") {
                setMessages((prev) => [...prev, { role: "agent", specialist: "community", message: `Found ${String(result["count"])} candidate(s).` }])
              }
            } else if (event.type === "error") {
              // Surface SSE-level errors in the latency log so we can
              // tell "edit hung" from "edit errored mid-turn".
              console.error(`[${tsNow()}] [edit-latency] SSE error: ${String(event.error ?? "Unknown")}`)
              setMessages((prev) => [...prev, { role: "agent", specialist: "hardware", message: `Error: ${event.error ?? "Unknown"}` }])
            }
          } catch { /* skip */ }
        }
      }

      // Finalize any remaining streaming text
      if (streamingTextAcc.length > 0) {
        assistantActions.push(streamingTextAcc)
      }

      // Remove any temporary _streaming messages from the sidebar
      setMessages((prev) => prev.filter((m) => m.specialist !== "_streaming"))

      // Store assistant turn in conversation history so follow-up messages have context
      if (assistantActions.length > 0) {
        conversationRef.current.push({ role: "assistant", content: assistantActions.join("\n") })
      }

      setCanvasStatus(null)
      setActiveSpecialists(new Set())
      setActiveStatuses({})
    } catch (err) {
      // Log at latency line so we correlate with timings. Connection
      // failed = fetch rejected (network, CORS, etc.) vs an SSE `error`
      // event which is a mid-stream error. Different failure mode.
      console.error(`[${tsNow()}] [edit-latency] fetch/connection error`, err)
      setMessages((prev) => [...prev, { role: "agent", specialist: "hardware", message: "Connection failed." }])
    } finally {
      // Stream ended (normally, erroring, or aborted). If a pending data
      // edit is still open, the apply_edit never returned. Log a
      // STREAM_END at the latency line so the devtools console always
      // has a visible boundary, and users don't stare at an empty log.
      const pendingStillOpen = pendingDataEdit !== null && editLatencyRef.current.tConfirm !== undefined && editLatencyRef.current.tApply === undefined
      if (pendingStillOpen) {
        const tStart = editLatencyRef.current.tEditStart ?? editLatencyRef.current.tSend
        const elapsed = tStart !== undefined ? Math.round(performance.now() - tStart) : 0
        console.warn(`[${tsNow()}] [edit-latency] STREAM_END with apply_edit incomplete (+${String(elapsed)}ms) — server did not finish the apply turn`)
      } else {
        // eslint-disable-next-line no-console
        console.log(`[${tsNow()}] [edit-latency] stream closed`)
      }
      setIsStreaming(false)
    }
  }, [isStreaming, canvasNodes, connections, handleToolCall, router, lastSelectedNodeId, pendingDataEdit])

  // Spec 029 phase 3.8.2: dispatch a queued confirm message after the
  // current stream closes. Races-safe because sendMessage has its own
  // isStreaming guard and we clear the ref before re-sending.
  useEffect(() => {
    if (isStreaming) return
    const queued = queuedConfirmMessageRef.current
    if (queued === null) return
    queuedConfirmMessageRef.current = null
    // eslint-disable-next-line no-console
    console.log(`[${tsNow()}] [edit-latency] dispatching queued confirm`)
    void sendMessage(queued)
  }, [isStreaming, sendMessage])

  // One rule: project exists in DB → never fire. Otherwise fire at most
  // once from a sessionStorage pending prompt (set by startProject) or a
  // legacy ?prompt= query param. When we DO fire fresh, also mark
  // `hydrated.current = true` so the auto-save effect is allowed to save
  // the new content — otherwise the save is gated off and tool-call
  // output never makes it to Redis.
  useEffect(() => {
    if (!clerkLoaded || !isLoaded || initialPromptSent.current || projectId === undefined) return
    initialPromptSent.current = true
    if (initialState !== null) return
    const key = `festivus:pending-prompt:${projectId}`
    let pending: string | null = null
    try { pending = sessionStorage.getItem(key) } catch { /* SSR */ }
    if (pending === null) pending = searchParams.get("prompt")
    if (pending === null || pending.length === 0) return
    try { sessionStorage.removeItem(key) } catch { /* noop */ }
    if (searchParams.get("prompt") !== null) router.replace(`/workbench/${projectId}`)
    hydrated.current = true
    sendMessage(pending)
  }, [clerkLoaded, isLoaded, initialState, searchParams, sendMessage, router, projectId])

  function startProject(prompt: string) {
    const id = `proj_${nanoid(8)}`
    // Stash the pending first-turn prompt under the new project id so the
    // target page can consume + delete it exactly once on mount. Keeping
    // it out of the URL means every project URL is safe to reload / bookmark
    // / share — the prompt can never re-fire.
    try { sessionStorage.setItem(`festivus:pending-prompt:${id}`, prompt) } catch { /* blocked */ }
    // Bridge the navigate → first-canvas-node gap with the global loader.
    // The 200ms threshold inside GlobalLoader means fast navs don't flash;
    // slow ones get a spinner. HIDE fires from the canvasNodes effect when
    // the agent's first tool call lands. Safety timeout below covers the
    // case where the agent never responds (network failure, API down).
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<IGlobalLoaderShowDetail>(GLOBAL_LOADER_SHOW, {
        detail: { label: "starting project" },
      }))
      window.setTimeout(() => {
        window.dispatchEvent(new Event(GLOBAL_LOADER_HIDE))
      }, 8000)
    }
    router.push(`/workbench/${id}`)
  }

  function handlePromptSubmit() {
    if (promptValue.trim().length === 0 || isStreaming) return
    const text = promptValue.trim()
    setPromptValue("")
    if (projectId === undefined) { startProject(text) } else { sendMessage(text) }
  }

  function handleOptionClick(option: string) { setAskUser(null); sendMessage(option) }

  // Spec 029 phase 3.5: confirm/cancel for the floating data-edit card.
  // The agent's apply_edit tool picks up the confirmation_token from the
  // same turn as the user's "yes", so we just echo the token in a user
  // message and the next assistant turn calls apply_edit.
  function handleDataEditConfirm() {
    const pe = pendingDataEdit
    if (!pe) return
    setPendingDataEditBusy(true)
    // Phase A latency — user just said "apply this". sendMessage below
    // will reset tSend, so capture tConfirm first.
    editLatencyRef.current.tConfirm = performance.now()
    const tStart = editLatencyRef.current.tEditStart
    if (tStart !== undefined) {
      // eslint-disable-next-line no-console
      console.log(`[${tsNow()}] [edit-latency] CONFIRM clicked at +${String(Math.round(editLatencyRef.current.tConfirm - tStart))}ms`)
    }
    const msg = `yes — apply the edit using confirmation_token ${pe.confirmation_token}`
    if (isStreaming) {
      // Claude's propose_edit turn hasn't closed yet. Queue; the effect
      // below dispatches when the stream closes.
      console.warn(`[${tsNow()}] [edit-latency] confirm queued — awaiting current stream close`)
      queuedConfirmMessageRef.current = msg
    } else {
      void sendMessage(msg)
    }
  }
  function handleDataEditCancel() {
    setPendingDataEdit(null)
    setPendingDataEditBusy(false)
    setMessages((prev) => [...prev, { role: "agent", specialist: "community", message: "Edit canceled." }])
  }

  // ── Render ────────────────────────────────────────────────────

  const hasNodes = rfNodes.length > 0

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false)

  // Latest agent message for bottom sheet handle preview
  const latestAgentMessage = useMemo(() => {
    const agentMsgs = messages.filter((m) => m.role === "agent" && m.specialist !== "_streaming")
    const last = agentMsgs.at(-1)
    return last !== undefined ? last.message : null
  }, [messages])

  if (!isLoaded && projectId !== undefined) {
    return <div className="flex h-screen items-center justify-center"><div className="text-zinc-400">Loading project...</div></div>
  }

  return (
    <div className="bg-drafting-cream flex h-screen flex-col">
      {/* Project drawer for signed-in users */}
      <ProjectDrawer
        currentProjectId={projectId}
        isMigrating={isMigrating}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      />

      {/* Navigation guard for guests */}
      {navGuardTarget !== null ? (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-50 flex justify-center">
          <div className="bg-white border-blueprint-navy/15 pointer-events-auto flex flex-col items-center gap-3 rounded-lg border px-8 py-5 shadow-lg">
            <p className="text-blueprint-navy text-sm font-medium">You have unsaved work</p>
            <p className="text-blueprint-navy/50 text-xs">Sign in to save it, or leave without saving.</p>
            <div className="flex items-center gap-3">
              <SignInButton mode="redirect">
                <button className="bg-blueprint-navy text-drafting-cream hover:bg-blueprint-navy/90 cursor-pointer rounded px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors" type="button">Sign in</button>
              </SignInButton>
              <button className="text-blueprint-navy/50 hover:text-blueprint-navy cursor-pointer rounded border border-current px-4 py-1.5 text-xs uppercase tracking-wider transition-colors" onClick={() => { setNavGuardTarget(null); router.push(navGuardTarget) }} type="button">Leave</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Header — desktop */}
      <div className="border-blueprint-navy/10 hidden shrink-0 items-center justify-between gap-6 border-b px-5 py-3 md:flex">
        <div className="flex items-center gap-6">
          {!isSignedIn && canvasNodes.length > 0 ? (
            <button className="text-blueprint-navy cursor-pointer text-base font-bold uppercase tracking-[0.18em] transition-opacity hover:opacity-60" onClick={() => setNavGuardTarget("/")} type="button">Festivus</button>
          ) : (
            <Link className="text-blueprint-navy text-base font-bold uppercase tracking-[0.18em] transition-opacity hover:opacity-60" href="/">Festivus</Link>
          )}
          <nav className="flex items-center gap-1">
            {[
              { href: "/", label: "Home", active: false },
              { href: "/data", label: "Data", active: false },
              { href: "/workbench", label: "Workbench", active: true, title: "Start a new project" },
              { href: "/contribute", label: "Contribute", active: false },
            ].map((item) => {
              const base = "rounded px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.15em]"
              const cls = item.active
                ? `${base} bg-blueprint-navy text-safety-yellow`
                : `${base} text-blueprint-navy/60 hover:text-blueprint-navy transition-colors`
              if (!isSignedIn && canvasNodes.length > 0) {
                return (
                  <button
                    aria-current={item.active ? "page" : undefined}
                    className={`${cls} cursor-pointer`}
                    key={item.href}
                    onClick={() => setNavGuardTarget(item.href)}
                    title={item.title}
                    type="button"
                  >
                    {item.label}
                  </button>
                )
              }
              return (
                <Link
                  aria-current={item.active ? "page" : undefined}
                  className={cls}
                  href={item.href}
                  key={item.href}
                  title={item.title}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <div className="group relative">
              <button
                className="border-blueprint-navy/15 hover:border-blueprint-navy/30 flex cursor-pointer items-center justify-center rounded-md border p-1.5 transition-colors"
                onClick={() => setDrawerOpen(true)}
                type="button"
              >
                <svg className="text-blueprint-navy/60 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="bg-blueprint-navy text-drafting-cream pointer-events-none absolute top-full right-0 mt-1 whitespace-nowrap rounded px-2 py-1 text-[12px] opacity-0 transition-opacity group-hover:opacity-100">Projects</div>
            </div>
          ) : null}
          <div className="group relative">
            <button
              className="border-blueprint-navy/15 hover:border-blueprint-navy/30 flex cursor-pointer items-center justify-center rounded-md border p-1.5 transition-colors"
              onClick={toggleBlueprintMode}
              type="button"
            >
              {blueprintMode ? (
                <svg className="text-blueprint-navy/60 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg className="text-blueprint-navy/60 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <div className="bg-blueprint-navy text-drafting-cream pointer-events-none absolute top-full right-0 mt-1 whitespace-nowrap rounded px-2 py-1 text-[12px] opacity-0 transition-opacity group-hover:opacity-100">Blueprint mode</div>
          </div>
          {isSignedIn ? (
            <UserButtonWithApiKeys />
          ) : (
            <SignInButton mode="redirect">
              <button className="text-blueprint-navy/70 hover:text-blueprint-navy cursor-pointer text-xs font-bold uppercase tracking-[0.2em] transition-colors" type="button">Sign in</button>
            </SignInButton>
          )}
        </div>
      </div>
      {/* Header — mobile */}
      <div className="border-blueprint-navy/10 flex shrink-0 items-center justify-between border-b px-4 py-3 md:hidden">
        {hasNodes ? (
          !isSignedIn && canvasNodes.length > 0 ? (
            <button className="text-blueprint-navy flex cursor-pointer items-center gap-1.5 text-xs font-bold" onClick={() => setNavGuardTarget("/workbench")} type="button">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
              Back
            </button>
          ) : (
            <Link className="text-blueprint-navy flex items-center gap-1.5 text-xs font-bold" href="/workbench">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
              Back
            </Link>
          )
        ) : (
          <Link className="text-blueprint-navy text-xs font-bold uppercase tracking-[0.2em]" href="/">Festivus</Link>
        )}
        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <UserButtonWithApiKeys />
          ) : (
            <SignInButton mode="redirect">
              <button className="text-blueprint-navy/70 hover:text-blueprint-navy cursor-pointer text-xs font-bold uppercase tracking-[0.2em] transition-colors" type="button">Sign in</button>
            </SignInButton>
          )}
          <button className="text-blueprint-navy p-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} type="button">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen
                ? <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                : <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              }
            </svg>
          </button>
        </div>
      </div>
      {/* Mobile menu dropdown */}
      {mobileMenuOpen ? (
        <div className="border-blueprint-navy/10 bg-white absolute top-12 right-0 left-0 z-50 border-b shadow-lg md:hidden">
          {[
            { label: "Home", href: "/", active: false },
            { label: "Data", href: "/data", active: false },
            { label: "Workbench", href: "/workbench", active: true },
            { label: "Contribute", href: "/contribute", active: false },
          ].map((item) => (
            <Link
              aria-current={item.active ? "page" : undefined}
              className={
                item.active
                  ? "bg-blueprint-navy text-safety-yellow block px-5 py-3 text-sm font-bold uppercase tracking-wider"
                  : "text-blueprint-navy hover:bg-blueprint-navy/5 block px-5 py-3 text-sm font-medium"
              }
              href={item.href}
              key={item.href}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}

      {/* Save nudge for guests */}
      <SaveNudge
        blueprintMode={blueprintMode}
        onDismiss={() => {
          setNudgeDismissed(true)
          try { sessionStorage.setItem("festivus_nudge_dismissed", "true") } catch { /* no sessionStorage */ }
        }}
        visible={!isSignedIn && promptCount >= 2 && !nudgeDismissed && !isStreaming}
      />

      {/* Specialist Bullpen Bar — hidden on mobile */}
      <div className="hidden md:block">
        <BullpenBar
          activeSpecialists={activeSpecialists}
          activeStatuses={activeStatuses}
          hoveredKey={bullpenHovered}
          onHover={setBullpenHovered}
          onPin={setBullpenPinned}
          pinnedKey={bullpenPinned}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative flex-1" style={{ backgroundColor: theme.canvasBg, transition: "background-color 300ms" }}>
          {/* Status toast — top-center of canvas, above all nodes */}
          {(() => {
            const status = canvasStatus ?? lastCanvasStatusRef.current
            if (status === null) return null
            const r = ROSTER.find((r) => r.key === status.specialist)
            return (
              <div
                className="pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2"
                style={{ opacity: canvasStatus !== null ? 1 : 0, transition: "opacity 400ms ease" }}
              >
                <div className="flex items-center gap-2.5 rounded-full px-5 py-2.5 shadow-lg" style={{ backgroundColor: theme.statusBadgeBg, transition: "background-color 300ms" }}>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2.5 w-2.5 animate-pulse rounded-full ${SPECIALIST_COLORS[status.specialist]?.bg ?? "bg-cold-gray"}`} />
                    <span className="text-[14px] font-medium" style={{ color: `${theme.statusBadgeText}b3` }}>{r?.name ?? status.specialist}</span>
                  </div>
                  <span style={{ color: `${theme.statusBadgeText}4d` }}>|</span>
                  <span className="text-xs font-bold" style={{ color: theme.statusBadgeText }}>{status.text}</span>
                  {turnProgress !== null && isStreaming ? (
                    <>
                      <span style={{ color: `${theme.statusBadgeText}4d` }}>|</span>
                      <span className="font-mono text-[13px] font-medium tabular-nums" style={{ color: `${theme.statusBadgeText}b3` }}>
                        step {turnProgress.current}/{turnProgress.max}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            )
          })()}

          {!hasNodes && !isStreaming && messages.length === 0 ? (() => {
            const GROUPS: Array<{ label: string; cards: Array<{ id: string; title: string; sub: string; prompt?: string; img?: string; dashed?: boolean }> }> = [
              { label: "I Have a Task", cards: [
                { id: "fold", title: "Fold Laundry", sub: "Bimanual fabric manipulation", prompt: "I want a robot that can fold laundry", img: "https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/main/aloha/aloha.png" },
                { id: "pick", title: "Pick and Place", sub: "Tabletop object sorting", prompt: "I want a robot for pick and place tasks", img: "https://raw.githubusercontent.com/TheRobotStudio/SO-ARM100/main/media/Leader_And_Follower_SO100.jpg" },
                { id: "clean", title: "Clean a Space", sub: "Navigate and tidy rooms", prompt: "I want a robot that can clean and organize a room", img: "https://raw.githubusercontent.com/unitreerobotics/unitree_rl_gym/main/resources/robots/g1_description/images/g1_29dof_with_hand.png" },
                { id: "warehouse", title: "Warehouse Sorting", sub: "Industrial bin picking at scale", prompt: "I need a robot for warehouse sorting and logistics", img: "https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/main/franka_emika_panda/panda.png" },
              ]},
              { label: "I Have a Robot", cards: [
                { id: "findpol", title: "Find Policies", sub: "What can my robot learn?", prompt: "I have a robot and want to find the best policies for it", img: "/images/landing/find-policies.svg" },
                { id: "sim", title: "Test in Sim", sub: "See my robot in simulation", prompt: "I have a robot and want to test it in simulation environments", img: "/images/landing/test-sim.svg" },
                { id: "deploy", title: "Deploy to Real World", sub: "Safety, regulatory, go-live", prompt: "I have a working robot and want to understand deployment requirements", img: "/images/landing/deploy.svg" },
              ]},
              { label: "I Have a Policy", cards: [
                { id: "findrob", title: "Find Robots", sub: "Which hardware runs this policy?", prompt: "I have a policy and want to find compatible robots to run it on", img: "/images/landing/find-robots.svg" },
                { id: "bench", title: "Benchmark Across Robots", sub: "Test one policy, many setups", prompt: "I have a policy and want to benchmark it across multiple robots and environments", img: "/images/landing/benchmark.svg" },
              ]},
              { label: "Explore by Capability", cards: [
                { id: "manip", title: "Manipulation", sub: "Arms, grippers, dexterous hands", prompt: "Show me the best robots and policies for manipulation tasks", img: "https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/main/aloha/aloha_wrist.png" },
                { id: "loco", title: "Locomotion", sub: "Walking, running, climbing", prompt: "Show me robots and policies for locomotion", img: "https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/main/unitree_go2/go2.png" },
                { id: "nav", title: "Navigation", sub: "Mapping, pathfinding, obstacles", prompt: "Show me robots and policies for autonomous navigation", img: "https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/main/unitree_g1/g1.png" },
                { id: "aerial", title: "Aerial", sub: "Drones, surveying, inspection", prompt: "Show me robots and policies for aerial tasks", img: "https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/main/universal_robots_ur5e/ur5e.png" },
              ]},
              { label: "Advanced", cards: [
                { id: "vla", title: "Find VLA Policies", sub: "Vision-language-action models", prompt: "I need a vision-language-action policy for my robot", img: "/images/landing/vla.svg" },
                { id: "real", title: "Real-World Tested Only", sub: "Skip sim, show field-proven setups", prompt: "Show me only robots and policies that have been tested outside a lab in real-world conditions", img: "/images/landing/real-world.svg" },
                { id: "gaps", title: "Community Gaps", sub: "Where can you contribute?", prompt: "Show me the biggest gaps in robotics datasets and policies where I can contribute", img: "/images/landing/gaps.svg" },
              ]},
            ]

            function renderCard(c: { id: string; title: string; sub: string; prompt?: string; img?: string; dashed?: boolean }, fullWidth?: boolean) {
              const isCreate = c.id === "create"
              const hovered = landingHover === c.id
              return (
                <button
                  className={`cursor-pointer overflow-hidden rounded-xl text-left ${fullWidth === true ? "w-full" : ""}`}
                  key={c.id}
                  onClick={() => {
                    if (isCreate) { document.querySelector<HTMLInputElement>("input[type=text]")?.focus() }
                    else if (c.prompt !== undefined) { startProject(c.prompt) }
                  }}
                  onMouseEnter={() => setLandingHover(c.id)}
                  onMouseLeave={() => setLandingHover(null)}
                  style={{
                    width: fullWidth === true ? "100%" : undefined,
                    minWidth: fullWidth === true ? undefined : 0,
                    maxWidth: fullWidth === true ? undefined : 180,
                    flex: fullWidth === true ? undefined : "1 1 0",
                    backgroundColor: blueprintMode ? "#1a2a45" : "#0B1C36",
                    borderTop: c.dashed === true ? "2px dashed #FFD326" : "2px solid #FFD326",
                    borderRight: hovered ? (c.dashed === true ? "2px dashed #FFD326" : "2px solid #FFD326") : blueprintMode ? "2px solid rgba(239,236,228,0.15)" : "2px solid transparent",
                    borderBottom: hovered ? (c.dashed === true ? "2px dashed #FFD326" : "2px solid #FFD326") : blueprintMode ? "2px solid rgba(239,236,228,0.15)" : "2px solid transparent",
                    borderLeft: hovered ? (c.dashed === true ? "2px dashed #FFD326" : "2px solid #FFD326") : blueprintMode ? "2px solid rgba(239,236,228,0.15)" : "2px solid transparent",
                    transform: hovered ? "translateY(-2px)" : "none",
                    transition: "transform 200ms, border-color 200ms, box-shadow 200ms, background-color 300ms",
                    boxShadow: hovered ? (blueprintMode ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(11,28,54,0.3)") : (blueprintMode ? "0 2px 8px rgba(0,0,0,0.3)" : "0 2px 8px rgba(11,28,54,0.15)"),
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-center overflow-hidden" style={{ height: fullWidth === true ? 60 : 95, backgroundColor: "rgba(255,211,38,0.06)" }}>
                    {c.img !== undefined ? <NodeImage alt={c.title} height={fullWidth === true ? 45 : 75} src={c.img} /> : null}
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    <p className="font-mono text-[14px] font-bold uppercase tracking-wider" style={{ color: "#EFECE4" }}>{c.title}</p>
                    <p className="mt-0.5 text-[13px]" style={{ color: "rgba(239,236,228,0.6)" }}>{c.sub}</p>
                  </div>
                </button>
              )
            }

            return (
              <div className="absolute inset-0 z-10 overflow-y-auto pb-16 md:pb-0">
                <div className="flex min-h-full flex-col items-start px-4 py-6 md:px-10 md:py-8">
                  {/* What you can do — 4 capability cards */}
                  <div className="mb-6 grid w-full grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
                    {([
                      { title: "Build a Robot", sub: "Find, buy, or 3D-print your first arm", prompt: "I want to build a robot" },
                      { title: "Train a Robot", sub: "Policies, sim, evaluation", prompt: "I want to train a robot policy" },
                      { title: "Deploy a Robot", sub: "Safety, regulatory, go-live", prompt: "I want to deploy a robot to production" },
                      { title: "Contribute", sub: "Benchmarks, URDFs, deploy notes", prompt: undefined },
                    ] as const).map((c) => (
                      <button
                        className="cursor-pointer rounded-lg p-3 text-left transition-all hover:-translate-y-px"
                        key={c.title}
                        onClick={() => { if (c.prompt !== undefined) startProject(c.prompt); else router.push("/contribute") }}
                        style={{
                          backgroundColor: blueprintMode ? "#1a2a45" : "#0B1C36",
                          border: "1px solid rgba(239,236,228,0.1)",
                        }}
                        type="button"
                      >
                        <p className="text-drafting-cream mb-1 text-xs font-bold uppercase tracking-wide">{c.title}</p>
                        <p className="text-drafting-cream/50 text-[13px]">{c.sub}</p>
                      </button>
                    ))}
                  </div>

                  <p className="mb-1 text-center font-mono text-sm font-bold uppercase tracking-[0.2em] md:text-left" style={{ width: "100%", color: blueprintMode ? "#EFECE4" : "#0B1C36" }}>Start a Project</p>
                  <p className="mb-4 text-center text-sm md:mb-6 md:text-left" style={{ width: "100%", color: "#6B7280" }}>Pick a scenario or describe your own</p>
                  {/* Create My Own — full width on mobile, fixed width on desktop */}
                  <div className="mb-4 w-full md:mb-6 md:w-auto">
                    {renderCard({ id: "create", title: "Create My Own", sub: "Describe any robotics project", img: "/images/landing/create-own.svg", dashed: true }, true)}
                  </div>
                  {GROUPS.map((g) => (
                    <div className="mb-4 w-full md:mb-6" key={g.label}>
                      <p className="mb-2 font-mono text-[14px] font-bold uppercase md:mb-2.5 md:text-sm" style={{ letterSpacing: "1px", color: blueprintMode ? "#EFECE4" : "#0B1C36" }}>{g.label}</p>
                      {/* Desktop: horizontal flex. Mobile: 2-column grid */}
                      <div className="grid grid-cols-2 gap-2 md:flex md:gap-3">
                        {g.cards.map((c) => renderCard(c))}
                      </div>
                    </div>
                  ))}
                  {/* More ideas */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-[14px] font-medium text-[#6B7280]">More ideas:</span>
                    {["Outdoor inspection", "Assembly line QA", "Kitchen assistant", "Educational robot kit", "Search and rescue"].map((idea) => (
                      <button className="cursor-pointer text-xs underline decoration-dotted transition-colors" key={idea} onClick={() => startProject(idea)} style={{ color: blueprintMode ? "rgba(239,236,228,0.5)" : "rgba(11,28,54,0.6)" }} type="button">{idea}</button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })() : null}

{/* ask_user now renders in sidebar, not here */}

          <ReactFlow
            edges={rfEdges}
            nodeTypes={nodeTypes}
            nodes={rfNodes}
            onConnect={onConnect}
            onEdgesChange={onEdgesChange}
            onInit={(instance) => { rfInstanceRef.current = instance }}
            onNodesChange={onNodesChange}
            proOptions={{ hideAttribution: true }}
          >
            <Background color={theme.gridColor} gap={24} variant={BackgroundVariant.Lines} />
          </ReactFlow>
        </div>

        {/* Agent Panel — desktop sidebar */}
        <div
          className={`bg-white border-blueprint-navy/10 hidden shrink-0 flex-col border-l md:flex transition-[width] duration-200 ${
            sidebarMode === "rail"
              ? "w-10"
              : sidebarMode === "wide"
                ? "w-[min(66vw,720px)]"
                : "w-80 lg:w-96 xl:w-[28rem]"
          }`}
        >
          {sidebarMode === "rail" ? (
            <button
              aria-label="Expand chat"
              className="text-blueprint-navy/70 hover:text-blueprint-navy hover:bg-blueprint-navy/5 flex h-full w-full cursor-pointer flex-col items-center gap-3 py-4 transition-colors"
              onClick={() => setSidebarMode("normal")}
              title="Expand chat (⌘\)"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[13px] font-bold uppercase tracking-wider [writing-mode:vertical-rl]">Festivus Agent</span>
            </button>
          ) : (
          <>
          <div className="border-blueprint-navy/10 flex items-center justify-between border-b px-5 py-4">
            <p className="text-blueprint-navy text-xs font-bold uppercase tracking-wider">Festivus Agent</p>
            <div className="flex items-center gap-0.5">
              <button
                aria-label={sidebarMode === "wide" ? "Normal width" : "Wide"}
                className="text-blueprint-navy/60 hover:text-blueprint-navy hover:bg-blueprint-navy/5 cursor-pointer rounded p-1 transition-colors"
                onClick={() => setSidebarMode(sidebarMode === "wide" ? "normal" : "wide")}
                title={sidebarMode === "wide" ? "Normal width" : "Wide"}
                type="button"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  {sidebarMode === "wide" ? (
                    <path d="M13 5l-7 7 7 7M20 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M11 5l-7 7 7 7M18 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              </button>
              <button
                aria-label="Collapse chat"
                className="text-blueprint-navy/60 hover:text-blueprint-navy hover:bg-blueprint-navy/5 cursor-pointer rounded p-1 transition-colors"
                onClick={() => setSidebarMode("rail")}
                title="Collapse chat (⌘\)"
                type="button"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-5" ref={agentPanelRef}>
            {messages.length === 0 ? (
              <p className="text-blueprint-navy/70 text-xs italic">Describe your project to get started.</p>
            ) : null}
            {messages.map((msg, i) => {
              // Defensive: never render tool JSON in sidebar
              if (msg.role === "agent" && containsLeakedToolJson(msg.message)) return null
              return (
              <div className={msg.role === "user" ? "text-right" : ""} key={i}>
                {msg.role === "agent" && msg.specialist !== undefined ? (
                  <div className="mb-1 flex items-center gap-1.5">
                    <div className={`h-2.5 w-2.5 rounded-full ${SPECIALIST_COLORS[msg.specialist]?.bg ?? "bg-cold-gray"}`} />
                    <span className="text-blueprint-navy/70 text-[12px] uppercase tracking-wider">{SPECIALIST_COLORS[msg.specialist]?.label ?? msg.specialist}</span>
                  </div>
                ) : null}
                <div className={`inline-block max-w-[min(90%,45ch)] rounded-lg px-3 py-2 text-xs leading-relaxed ${msg.role === "user" ? "bg-blueprint-navy text-drafting-cream" : "bg-blueprint-navy/5 text-blueprint-navy"}`}>
                  <span className="whitespace-pre-line">{msg.message}</span>
                </div>
                {msg.thinking !== undefined || (msg.api_calls !== undefined && msg.api_calls.length > 0) ? (
                  <details className="mt-1">
                    <summary className="text-blueprint-navy/70 cursor-pointer text-[12px] hover:underline">Show process</summary>
                    <div className={`mt-1 space-y-2 rounded border-l-2 p-2 ${SPECIALIST_COLORS[msg.specialist ?? ""]?.tint ?? "bg-blueprint-navy/[0.02]"} ${SPECIALIST_COLORS[msg.specialist ?? ""]?.border ?? "border-l-blueprint-navy/20"}`}>
                      {msg.thinking !== undefined ? (
                        <p className="whitespace-pre-line text-[13px] leading-relaxed text-blueprint-navy/70">{msg.thinking}</p>
                      ) : null}
                      {msg.api_calls !== undefined && msg.api_calls.length > 0 ? (
                        <div className="space-y-1">
                          <div className="text-blueprint-navy/60 text-[12px] uppercase tracking-wider">API calls ({msg.api_calls.length})</div>
                          <ul className="space-y-1">
                            {msg.api_calls.map((call, callIdx) => (
                              <li className="text-[13px] leading-tight" key={callIdx}>
                                <div className="text-blueprint-navy/70 font-mono">{call.name} · {call.duration_ms}ms</div>
                                <a
                                  className="text-blueprint-navy/80 block break-all font-mono text-[12px] underline decoration-dotted underline-offset-2 hover:text-blueprint-navy"
                                  href={call.url}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  {call.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </div>
              )
            })}
            {isStreaming ? (() => {
              const activeKey = canvasStatus?.specialist ?? [...activeSpecialists].at(-1)
              const r = activeKey !== undefined ? ROSTER.find((r) => r.key === activeKey) : undefined
              return (
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ backgroundColor: r?.ring ?? "rgba(11,28,54,0.2)" }} />
                  <span className="text-[13px] font-medium" style={{ color: r?.text ?? "rgba(11,28,54,0.5)" }}>
                    Thinking...
                  </span>
                </div>
              )
            })() : null}
          </div>
          {/* ask_user pill buttons */}
          {askUser !== null ? (
            <div className="border-blueprint-navy/10 border-t px-4 py-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-blueprint-navy question-flash text-xs font-bold" key={`q-${askUserKey}`}>{askUser.question}</p>
                <button aria-label="Dismiss suggestions" className="text-blueprint-navy/40 hover:text-blueprint-navy -mt-0.5 shrink-0 cursor-pointer p-0.5 transition-colors" onClick={() => setAskUser(null)} type="button">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
              <div className="chip-fade-in flex flex-wrap gap-1.5" key={`chips-${askUserKey}`}>
                {askUser.options?.map((opt, i) => (
                  <button
                    // First option gets the highlight-pulse so eyes land
                    // on it. Hover/focus removes the pulse via opacity
                    // fallback. User complained ask_user chips get lost;
                    // this makes the "you can click these" obvious.
                    className={`border-blueprint-navy/15 hover:border-blueprint-navy hover:bg-blueprint-navy hover:text-drafting-cream cursor-pointer rounded-full border px-3 py-1.5 text-left text-[14px] transition-colors ${i === 0 ? "highlight-pulse" : ""}`}
                    key={opt}
                    onClick={() => handleOptionClick(opt)}
                    type="button"
                  >
                    {opt}
                  </button>
                )) ?? null}
              </div>
            </div>
          ) : null}
          {/* Prompt input */}
          <div className="border-blueprint-navy/10 border-t p-3">
            <div className="flex items-center gap-2">
              <input autoComplete="off" className="border-blueprint-navy/20 focus:border-blueprint-navy text-blueprint-navy placeholder:text-blueprint-navy/50 flex-1 rounded border px-3 py-2 text-xs outline-none transition-colors" disabled={isStreaming} onChange={(e) => { setPromptValue(e.target.value); if (e.target.value.length > 0) setAskUser(null) }} onKeyDown={(e) => { if (e.key === "Enter") handlePromptSubmit() }} placeholder={isStreaming ? (canvasStatus?.text ?? "Thinking...") : hasNodes ? "What do you want to do?" : "Or describe what you want to build..."} type="text" value={promptValue} />
              <button className="bg-blueprint-navy text-drafting-cream hover:bg-blueprint-navy/90 cursor-pointer rounded px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50" disabled={isStreaming} onClick={handlePromptSubmit} type="button">Send</button>
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      {/* Tray */}
      {tray.length > 0 ? (
        <div className="border-blueprint-navy/10 bg-white border-t">
          <button className="text-blueprint-navy/70 hover:text-blueprint-navy flex w-full cursor-pointer items-center gap-2 px-5 py-2 text-[13px] font-bold uppercase tracking-wider" onClick={() => setTrayOpen(!trayOpen)} type="button">
            <svg className={`h-3 w-3 transition-transform ${trayOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
            Alternatives ({tray.length})
          </button>
          {trayOpen ? (
            <div className="flex flex-wrap gap-2 px-5 pb-3">
              {tray.map((item) => (
                <button className="border-blueprint-navy/15 hover:border-blueprint-navy text-blueprint-navy flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] transition-colors" key={item.node.id} onClick={() => restoreFromTray(item)} type="button">
                  <span className="font-bold">{(item.node.data["name"] as string | undefined) ?? item.node.id}</span>
                  <span className="text-blueprint-navy/70">{item.node.type}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Version timeline */}
      {snapshots.length > 0 ? (
        <div className="border-blueprint-navy/10 bg-white flex items-center gap-1 border-t px-5 py-2">
          <span className="text-blueprint-navy/70 mr-2 text-[12px] font-bold uppercase tracking-wider">History</span>
          {snapshots.map((snap, i) => (
            <button className="group relative cursor-pointer" key={snap.timestamp} onClick={() => loadSnapshot(snap)} type="button">
              <div className={`h-2.5 w-2.5 rounded-full transition-colors ${i === snapshots.length - 1 ? "bg-blueprint-navy" : "bg-blueprint-navy/30 hover:bg-blueprint-navy/60"}`} />
              <div className="bg-blueprint-navy text-drafting-cream pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-[12px] opacity-0 transition-opacity group-hover:opacity-100">v{i + 1}: {snap.label}</div>
            </button>
          ))}
        </div>
      ) : null}

      {/* Environment Viewer */}
      {envViewerNode !== null ? (
        <EnvironmentViewer breadcrumb={{}} env={{ slug: envViewerNode.id, name: (envViewerNode.data["name"] as string) ?? envViewerNode.id, simulator: (envViewerNode.data["simulator"] as string) ?? "MuJoCo", description: (envViewerNode.data["description"] as string) ?? "", deployCommand: (envViewerNode.data["deploy_command"] as string) ?? "" }} onClose={() => setEnvViewerNode(null)} />
      ) : null}

      {/* ── Mobile bottom sheet + prompt bar ── */}
      <div className="md:hidden">
        {/* Fixed prompt bar — always visible above bottom sheet handle */}
        <div className="bg-white border-blueprint-navy/10 fixed right-0 bottom-10 left-0 z-40 border-t px-3 py-2">
          <div className="flex items-center gap-2">
            <input
              autoComplete="off"
              className="border-blueprint-navy/20 focus:border-blueprint-navy text-blueprint-navy placeholder:text-blueprint-navy/50 flex-1 rounded border px-3 py-2.5 text-sm outline-none"
              disabled={isStreaming}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handlePromptSubmit() }}
              placeholder={isStreaming ? (canvasStatus?.text ?? "Thinking...") : hasNodes ? "What do you want to do?" : "Describe what you want to build..."}
              type="text"
              value={promptValue}
            />
            <button className="bg-blueprint-navy text-drafting-cream rounded px-4 py-2.5 text-sm font-bold disabled:opacity-50" disabled={isStreaming} onClick={handlePromptSubmit} type="button">Send</button>
          </div>
        </div>

        {/* Bottom sheet handle — 40px, always visible, shows latest message */}
        {hasNodes ? (
          <>
            <button
              className="bg-white border-blueprint-navy/10 fixed right-0 bottom-0 left-0 z-40 flex items-center gap-2 border-t px-4"
              onClick={() => setBottomSheetOpen(!bottomSheetOpen)}
              style={{ height: 40 }}
              type="button"
            >
              <div className="mx-auto h-1 w-8 rounded-full bg-blueprint-navy/20" />
              {latestAgentMessage !== null ? (
                <p className="text-blueprint-navy/60 absolute right-4 left-14 truncate text-[14px]">{latestAgentMessage}</p>
              ) : null}
            </button>

            {/* Bottom sheet content — slides up */}
            {bottomSheetOpen ? (
              <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col" style={{ height: "60vh" }}>
                {/* Backdrop */}
                <button className="fixed inset-0 z-40 bg-black/20" onClick={() => setBottomSheetOpen(false)} type="button" />
                {/* Sheet */}
                <div className="bg-white relative z-50 flex h-full flex-col rounded-t-2xl shadow-2xl">
                  {/* Drag handle */}
                  <button className="flex shrink-0 items-center justify-center py-2" onClick={() => setBottomSheetOpen(false)} type="button">
                    <div className="h-1 w-8 rounded-full bg-blueprint-navy/20" />
                  </button>
                  {/* Bullpen bar inside sheet */}
                  <div className="shrink-0 overflow-x-auto">
                    <BullpenBar
                      activeSpecialists={activeSpecialists}
                      activeStatuses={activeStatuses}
                      hoveredKey={bullpenHovered}
                      onHover={setBullpenHovered}
                      onPin={setBullpenPinned}
                      pinnedKey={bullpenPinned}
                    />
                  </div>
                  {/* Messages */}
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {messages.map((msg, i) => {
                      if (msg.role === "agent" && containsLeakedToolJson(msg.message)) return null
                      return (
                      <div className={msg.role === "user" ? "text-right" : ""} key={i}>
                        {msg.role === "agent" && msg.specialist !== undefined && msg.specialist !== "_streaming" ? (
                          <div className="mb-1 flex items-center gap-1.5">
                            <div className={`h-2.5 w-2.5 rounded-full ${SPECIALIST_COLORS[msg.specialist]?.bg ?? "bg-cold-gray"}`} />
                            <span className="text-blueprint-navy/70 text-[12px] uppercase tracking-wider">{SPECIALIST_COLORS[msg.specialist]?.label ?? msg.specialist}</span>
                          </div>
                        ) : null}
                        <div className={`inline-block max-w-[min(90%,45ch)] rounded-lg px-3 py-2 text-xs leading-relaxed ${msg.role === "user" ? "bg-blueprint-navy text-drafting-cream" : "bg-blueprint-navy/5 text-blueprint-navy"}`}>
                          <span className="whitespace-pre-line">{msg.message}</span>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                  {/* ask_user in bottom sheet */}
                  {askUser !== null ? (
                    <div className="border-blueprint-navy/10 shrink-0 border-t px-4 py-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-blueprint-navy question-flash text-xs font-bold" key={`q-sheet-${askUserKey}`}>{askUser.question}</p>
                        <button aria-label="Dismiss suggestions" className="text-blueprint-navy/40 hover:text-blueprint-navy -mt-0.5 shrink-0 cursor-pointer p-0.5 transition-colors" onClick={() => setAskUser(null)} type="button">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      </div>
                      <div className="chip-fade-in flex flex-col gap-1.5" key={`chips-sheet-${askUserKey}`}>
                        {askUser.options?.map((opt, i) => (
                          <button
                            className={`border-blueprint-navy/15 hover:bg-blueprint-navy hover:text-drafting-cream w-full rounded-lg border px-3 py-3 text-left text-xs transition-colors ${i === 0 ? "highlight-pulse" : ""}`}
                            key={opt}
                            onClick={() => { handleOptionClick(opt); setBottomSheetOpen(false) }}
                            type="button"
                          >
                            {opt}
                          </button>
                        )) ?? null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {/* First-visit discovery toast pointing at the Festivus Agent sidebar. */}
      <AskAIDiscoveryToast
        message="Festivus Agent lives here. Ask it anything."
        storageKey="festivus_workbench_agent_toast_seen"
        variant="right-sidebar"
      />

      {/* Floating data-edit confirmation card (spec 029 phase 3.5) */}
      {pendingDataEdit !== null ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-40 flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-md shadow-xl">
            <ConfirmationCard
              busy={pendingDataEditBusy}
              onCancel={handleDataEditCancel}
              onConfirm={handleDataEditConfirm}
              pending={{
                table: pendingDataEdit.table,
                slug: pendingDataEdit.slug,
                field: pendingDataEdit.field,
                value: pendingDataEdit.value,
                reason: pendingDataEdit.reason,
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
