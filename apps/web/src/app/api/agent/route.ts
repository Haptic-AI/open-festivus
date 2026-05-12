import Anthropic from "@anthropic-ai/sdk"
import type { ContentBlock, MessageParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages"
import { NextResponse } from "next/server"
import { API_TOOL_NAMES, callApiTool } from "@/lib/agent/api-tools"
import { buildFallbackAskUser, buildFallbackDeployment, buildFallbackHardwareSummary } from "@/lib/agent/fallbacks"
import { buildStableSystemPrompt, buildDynamicSystemPrompt } from "@/lib/agent/system-prompt"
import { AGENT_TOOLS } from "@/lib/agent/tools"
import { loadSeedData } from "@/lib/agent/seed-data"
import { FestivusClient, type IFestivusClient } from "@/lib/api/festivus-client"
import { MockFestivusClient } from "@/lib/api/mock-festivus-client"
import { getRequestUser } from "@/lib/auth"
import { listKeysFor } from "@/lib/api-keys-forwarder"
import {
  executeApplyEdit,
  executeListCandidates,
  executeProposeEdit,
  type IToolExecutorDeps,
} from "@/lib/edit-primitives/execute-tool"
import {
  createApiToolCalled,
  createAssistantMessageChunk,
  createCanvasToolCalled,
  createRequestEnd,
  createRequestStart,
  createSpecialistActivated,
} from "@/lib/agent/trace/events"
import { resolveSink } from "@/lib/agent/trace/resolve"

// Edit-tool names match lib/edit-primitives/tools.ts. Kept in sync manually
// rather than importing to avoid a runtime dep on tool definitions in the
// dispatcher — cheap, tests would catch drift.
const EDIT_TOOL_NAMES: ReadonlySet<string> = new Set([
  "list_candidates",
  "propose_edit",
  "apply_edit",
])

const AGENT_MODEL = "claude-sonnet-4-20250514"

const TOOL_RESULT_CHAR_BUDGET = 8000

function capToolResultContent(content: string): string {
  if (content.length <= TOOL_RESULT_CHAR_BUDGET) return content
  const head = content.slice(0, TOOL_RESULT_CHAR_BUDGET)
  return `${head}\n\n[TRUNCATED — original was ${content.length} chars; tighten the query (e.g. lower limit, add filters) and call again if you need more]`
}

function withRenderReminder(toolName: string, payload: string): string {
  const isError = payload.startsWith('{"error":')
  const isEmpty = payload.startsWith('{"count":0')

  if (toolName === "search_tasks") {
    if (isError) return payload
    if (isEmpty) {
      return `${payload}\n\n[HARD REMINDER — DO NOT IGNORE] No matching tasks in the dataset, but you MUST still call add_node with node_type="task" to anchor the project graph before searching for hardware. Synthesize a task record from the user's goal: name (human-readable goal), slug (kebab-case, e.g. "fold-laundry"), description (the decomposition you just wrote in show_agent_message), category ("manipulation" | "locomotion" | "navigation" | "aerial" | "other"), sub_tasks (string array from your breakdown), difficulty ("easy" | "medium" | "hard" | "unsolved"). Rule 2 (canvas first) is a HARD invariant. DO NOT proceed to search_robots without first adding the task node.`
    }
    return `${payload}\n\n[HARD REMINDER — DO NOT IGNORE] You just received search_tasks results above. You MUST call add_node with node_type="task" for the top matching result — pass name, slug, description, category, sub_tasks, difficulty verbatim from the data above. The task node is the anchor of the project graph and the user needs to see it before any hardware. Rule 2 is a HARD invariant. DO NOT proceed to search_robots without first adding the task node.`
  }

  if (isError || isEmpty) return payload

  if (toolName === "search_robots") {
    return `${payload}\n\n[HARD REMINDER — DO NOT IGNORE] You just received search_robots results above.

STEP A (broaden if thin, but accept honest zeros): Rule 3 targets up to 10 relevant matches. If your search was narrow (e.g. \`has_policies=true\` or a strict \`type\`) and returned fewer than 5, try ONE more call with broader filters — drop \`has_policies\`, try a different \`type\`, or use free-text \`q\`. But if the broader search also comes back thin, that is the genuine shape of the dataset — DO NOT keep searching forever, and DO NOT synthesize fake robots to hit a count. Zero is a legitimate outcome.

STEP B (emit add_node for what you have): Once you have your final candidate set, emit one add_node call per relevant robot, up to 10. Use node_type="robot", exploration_group="robots-1". Pass name, slug, manufacturer, type, dof, price_usd, deploy_readiness, image_url, description, product_page_url verbatim. Emit all add_node calls in a single assistant turn. If you ended with exactly 1 relevant match, add that 1 (Rule 3's "never just one" does NOT apply when the dataset truly has only 1 — it applies when you're artificially limiting yourself).

STEP C (specialist messages + ask_user): Regardless of how many (or zero) robots you added, you MUST still emit: (1) show_agent_message(specialist="hardware") with a 2-4 sentence comparison or gap explanation; (2) if ≥ 1 robot was added, show_agent_message(specialist="deployment") annotating the safety profile; (3) ask_user with 4-5 distinct follow-up options. If you added 0 robots, skip (2) and make the hardware message explain the gap + hand off to Community Scout.

DO NOT end your turn silently. Rules 2, 3, 4, and 10 are HARD invariants.`
  }
  if (toolName === "search_policies") {
    return `${payload}\n\n[HARD REMINDER — DO NOT IGNORE] You just received search_policies results above. Before ending this turn you MUST, IN ORDER: (1) call add_node with node_type="policy" and exploration_group="policies-1" for EVERY relevant result, up to 10 — floor is 2 (emitting only 1 is a HARD VIOLATION of Rule 3), ceiling is 10. Pass name, slug, author, framework, evidence_level, hf_repo_id, benchmarks verbatim. (2) call show_agent_message (specialist="policy") with a 2-4 sentence summary; (3) call ask_user with 4-5 distinct follow-up options. Rules 2, 3, and 10 are HARD invariants.`
  }
  return payload
}

// Step 3.5: When the request carries the X-Test-Mock-Client header, swap in
// a deterministic in-process MockFestivusClient. This is the difference
// between the old fake smoke test (which only verified "no errors") and
// the real one (which verifies api_tool_called fires AND the answer
// mentions data from the mock).
function clientForRequest(request: Request): IFestivusClient | undefined {
  if (request.headers.get("x-test-mock-client") === "1") {
    return new MockFestivusClient()
  }
  return undefined
}

const anthropic = new Anthropic()

const MAX_TURNS = 40
const MAX_RETRIES = 3
const RETRY_BASE_MS = 1000

function sseEvent(encoder: TextEncoder, data: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      message: string
      projectState: Record<string, unknown>
      conversationHistory?: MessageParam[]
      // Spec 029 phase 3.6. When the user has a canvas node selected,
      // the client sends its underlying record so Claude knows which
      // Postgres row "fix the weight" means. Mirrors agent-chat's
      // IPageContext. Optional — null when no node is selected.
      context?: { table: string; slug: string; recordName: string } | null
    }

    const seedData = loadSeedData()
    void seedData  // retained for future reintroduction of seed inlining
    const projectStateStr = JSON.stringify(body.projectState, null, 2)
    // Prompt caching (spec 029 phase 3.8). Stable ~3.8k-token prefix is
    // marked cache_control:ephemeral; project state + active-canvas-node
    // context sit in a non-cached trailing block. Expected impact on
    // turn latency: first turn of a session pays ~full cost, subsequent
    // turns serve against the cached prefix (~10x cheaper + faster).
    const stableSystem = buildStableSystemPrompt()
    const dynamicSystem = buildDynamicSystemPrompt(projectStateStr)
    const ctx = body.context
    const dynamicWithCtx = ctx
      ? `${dynamicSystem}\n\n## Active canvas node (authoritative)\n\nThe user has **${ctx.recordName}** selected on the canvas. When they say "this", "it", or "the record" without naming a slug, they mean \`${ctx.table}/${ctx.slug}\`. Target this record for data edits unless the user explicitly names a different one.`
      : dynamicSystem
    const systemBlocks = [
      { type: "text" as const, text: stableSystem, cache_control: { type: "ephemeral" as const } },
      { type: "text" as const, text: dynamicWithCtx },
    ]
    // Also cache the tools array (CANVAS + API + edit tools, ~4-5k
    // tokens). Marking cache_control on the LAST tool caches the
    // entire tools prefix per Anthropic's rules.
    const cachedTools = AGENT_TOOLS.length > 0
      ? [
          ...AGENT_TOOLS.slice(0, -1),
          { ...AGENT_TOOLS[AGENT_TOOLS.length - 1]!, cache_control: { type: "ephemeral" as const } },
        ]
      : AGENT_TOOLS
    const apiClient = clientForRequest(request)
    // Authoritative data source for server-side enrichment of canvas node payloads.
    // Uses the test mock when X-Test-Mock-Client is set, otherwise the real API.
    const dataClient: IFestivusClient = apiClient ?? new FestivusClient()

    // Edit-tool deps: apply_edit needs a signed-in user + active fek_* to
    // forward-write via the moderator key. list_candidates + propose_edit
    // are read-only / pre-commit and don't need auth. Resolve auth once up
    // front so the dispatcher is side-effect free on the hot path.
    const editUser = await getRequestUser()
    let editUserHasKey = false
    if (editUser !== null) {
      try {
        const keys = await listKeysFor(editUser.id)
        editUserHasKey = keys.some((k) => k.revoked_at === null)
      } catch {
        editUserHasKey = false
      }
    }
    const editDeps: IToolExecutorDeps = {
      readApiUrl: process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai",
      writeApiUrl: process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai",
      moderatorKey: process.env["FESTIVUS_MODERATOR_KEY"] ?? "",
      userClerkId: editUser?.id ?? "",
    }

    const request_id = crypto.randomUUID()
    const sink = resolveSink(request_id)
    const startedAt = Date.now()
    sink.emit(
      createRequestStart({
        t: startedAt,
        request_id,
        system: "anthropic",
        model: AGENT_MODEL,
        question: body.message,
      }),
    )

    const messages: MessageParam[] = [
      ...(body.conversationHistory ?? []),
      { role: "user", content: body.message },
    ]

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let askedUser = false
        let hasDeploymentMessage = false
        let hasHardwareMessage = false
        const addedNodeTypes: string[] = []
        const addedNodeNames: string[] = []
        let chunkIndex = 0
        let totalInputTokens = 0
        let totalOutputTokens = 0
        let searchRobotsHadCandidates = false
        let silentEndRetryUsed = false

        try {
          let turnCount = 0

          while (turnCount < MAX_TURNS) {
            turnCount++

            // Tell the client which turn we're on so the UI can show
            // a quota counter. Visible to the canvas, not the model.
            controller.enqueue(sseEvent(encoder, {
              type: "turn_progress",
              current: turnCount,
              max: MAX_TURNS,
            }))

            // Spec 029 phase 3.8 — per-turn wall-clock + cache stats. Lets
            // us tell "Anthropic is slow" from "our code is slow" and
            // "cache is hitting" from "cache is missing". Logged to server
            // stdout so we see it in Vercel logs.
            const turnStart = Date.now()

            // Retry wrapper for overloaded errors
            let messageStream: ReturnType<typeof anthropic.messages.stream> | null = null
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
              try {
                messageStream = anthropic.messages.stream({
                  model: AGENT_MODEL,
                  max_tokens: 4096,
                  system: systemBlocks,
                  messages,
                  tools: cachedTools,
                })
                break
              } catch (err: unknown) {
                const isOverloaded = err instanceof Error && (err.message.includes("overloaded") || err.message.includes("529"))
                if (!isOverloaded || attempt === MAX_RETRIES - 1) throw err
                await new Promise((r) => setTimeout(r, RETRY_BASE_MS * (attempt + 1)))
              }
            }
            if (messageStream === null) throw new Error("Failed to create stream")

            // Stream text deltas to client immediately (typewriter effect)
            // Guard: suppress text that looks like tool call descriptions
            let textAccumulator = ""
            messageStream.on("text", (textDelta: string) => {
              if (textDelta.length > 0) {
                textAccumulator += textDelta
                if (!textAccumulator.includes('"tool_use"') && !textAccumulator.includes('"name":') && !textAccumulator.includes("add_node") && !textAccumulator.includes("show_agent_message")) {
                  controller.enqueue(sseEvent(encoder, { type: "text_delta", text: textDelta }))
                  sink.emit(
                    createAssistantMessageChunk({
                      t: Date.now(),
                      request_id,
                      index: chunkIndex++,
                      bytes: Buffer.byteLength(textDelta, "utf8"),
                      text: textDelta,
                    }),
                  )
                }
              }
            })

            // Stream complete content blocks (tool calls appear as soon as they're done).
            // API tools are server-side and never forwarded to the client — the model
            // sees their results in the next turn, but the canvas does not.
            // Exception: in test mode (X-Test-Mock-Client header) the route emits
            // an `api_tool_called` SSE event so the smoke test can verify the
            // agent actually invoked the tool.
            // Canvas tool emits run through this queue so server-side enrichment
            // (e.g. replacing the model's add_node data with the authoritative
            // postgres row) can await I/O before the SSE event ships, while
            // preserving arrival order across blocks. Await it after finalMessage.
            let canvasEmitQueue: Promise<void> = Promise.resolve()

            const emitCanvasBlock = (block: ToolUseBlock): void => {
              controller.enqueue(sseEvent(encoder, {
                type: "tool_call",
                name: block.name,
                input: block.input,
              }))
              sink.emit(
                createCanvasToolCalled({
                  t: Date.now(),
                  request_id,
                  name: block.name,
                  arguments: block.input,
                }),
              )
            }

            messageStream.on("contentBlock", (block: ContentBlock) => {
              if (block.type === "tool_use") {
                if (API_TOOL_NAMES.has(block.name)) {
                  // api_tool_called is emitted post-call below (after
                  // callApiTool completes), with the final wire URLs and
                  // duration. Nothing to stream at content-block time.
                  return
                }
                // Deterministic enrichment path: for add_node(node_type=robot),
                // discard the model's `data` and replace it with the authoritative
                // record from /v1/robots/{slug}. This removes model discretion over
                // which robot fields make it to the canvas — every field the UI
                // reads (product_page_url, etc.) is sourced from postgres.
                const isRobotAddNode =
                  block.name === "add_node" &&
                  (block.input as Record<string, unknown>)["node_type"] === "robot"
                if (isRobotAddNode) {
                  const input = block.input as Record<string, unknown>
                  const modelData = (input["data"] as Record<string, unknown> | undefined) ?? {}
                  const slug = typeof modelData["slug"] === "string" ? modelData["slug"] as string : undefined
                  canvasEmitQueue = canvasEmitQueue.then(async () => {
                    if (slug !== undefined) {
                      try {
                        const authoritative = await dataClient.getRobot(slug)
                        if (authoritative !== null) {
                          // Authoritative row wins. Preserve any model-only keys
                          // the card might read (e.g. compat hints) by spreading
                          // model data first and letting the real row overwrite.
                          input["data"] = { ...modelData, ...authoritative }
                        }
                      } catch (err) {
                        console.error(`[agent route] robot enrichment failed for slug=${slug}`, err)
                      }
                    }
                    emitCanvasBlock(block)
                  })
                  // Still track stats synchronously so post-turn nudges see this.
                  addedNodeTypes.push("robot")
                  const name = modelData["name"]
                  const price = modelData["price_usd"]
                  if (typeof name === "string") {
                    addedNodeNames.push(typeof price === "number" ? `${name} ($${price.toLocaleString()})` : name)
                  }
                  return
                }
                emitCanvasBlock(block as ToolUseBlock)
                if (block.name === "ask_user") askedUser = true
                if (block.name === "show_agent_message") {
                  const input = block.input as Record<string, unknown>
                  if (input["specialist"] === "deployment") hasDeploymentMessage = true
                  if (input["specialist"] === "hardware") hasHardwareMessage = true
                  const specialist = input["specialist"]
                  if (typeof specialist === "string" && specialist.length > 0) {
                    sink.emit(
                      createSpecialistActivated({
                        t: Date.now(),
                        request_id,
                        specialist,
                      }),
                    )
                  }
                }
                if (block.name === "add_node") {
                  const input = block.input as Record<string, unknown>
                  const nodeType = input["node_type"] as string | undefined
                  if (nodeType !== undefined) addedNodeTypes.push(nodeType)
                  if (nodeType === "robot" || nodeType === "policy" || nodeType === "environment") {
                    const data = input["data"] as Record<string, unknown> | undefined
                    const name = data?.["name"]
                    const price = data?.["price_usd"]
                    if (typeof name === "string") {
                      addedNodeNames.push(typeof price === "number" ? `${name} ($${price.toLocaleString()})` : name)
                    }
                  }
                }
              }
            })

            // Wait for the complete message
            const finalMessage = await messageStream.finalMessage()
            // Ensure any deferred canvas emits (robot enrichment) have shipped
            // before we start emitting post-turn nudges or move to the next turn.
            await canvasEmitQueue
            totalInputTokens += finalMessage.usage?.input_tokens ?? 0
            totalOutputTokens += finalMessage.usage?.output_tokens ?? 0
            // Cache-hit visibility. cache_read_input_tokens > 0 means the
            // prefix was served from cache; cache_creation_input_tokens > 0
            // means we wrote a new cache entry this turn. Both 0 means we
            // paid full price.
            const usage = finalMessage.usage as (typeof finalMessage.usage & {
              cache_read_input_tokens?: number
              cache_creation_input_tokens?: number
            }) | undefined
            const cacheRead = usage?.cache_read_input_tokens ?? 0
            const cacheWrite = usage?.cache_creation_input_tokens ?? 0
            const turnMs = Date.now() - turnStart
            // eslint-disable-next-line no-console
            console.log(`[agent/turn] turn=${String(turnCount)} ms=${String(turnMs)} in=${String(usage?.input_tokens ?? 0)} out=${String(usage?.output_tokens ?? 0)} cache_read=${String(cacheRead)} cache_write=${String(cacheWrite)} stop=${String(finalMessage.stop_reason ?? "?")}`)

            // If the model wants to use tools, send back results and continue
            if (finalMessage.stop_reason === "tool_use") {
              messages.push({ role: "assistant", content: finalMessage.content })

              const toolUseBlocks = finalMessage.content
                .filter((b: ContentBlock): b is ToolUseBlock => b.type === "tool_use")

              const hasExplorationNodes = toolUseBlocks.some((b: ToolUseBlock) => {
                const input = b.input as Record<string, unknown>
                return b.name === "add_node" && input["exploration_group"] !== undefined
              })

              const hasRobotNodes = addedNodeTypes.includes("robot")
              const needsDeployment = hasRobotNodes && !hasDeploymentMessage

              const toolResults = await Promise.all(toolUseBlocks.map(async (toolUse: ToolUseBlock) => {
                // Edit tools (spec 029 phase 3). Gated differently:
                //   list_candidates / propose_edit — no auth required
                //   apply_edit — requires signed-in user + active fek_*
                //                or the tool_result returns auth_required
                //                so Claude can apologise gracefully.
                if (EDIT_TOOL_NAMES.has(toolUse.name)) {
                  let result: unknown
                  try {
                    if (toolUse.name === "list_candidates") {
                      result = await executeListCandidates(editDeps, toolUse.input as never)
                    } else if (toolUse.name === "propose_edit") {
                      result = await executeProposeEdit(editDeps, toolUse.input as never)
                    } else if (toolUse.name === "apply_edit") {
                      if (editUser === null) {
                        result = {
                          ok: false,
                          error: "auth_required",
                          message: "Sign in to apply this edit.",
                          cta: "/sign-in",
                        }
                      } else if (!editUserHasKey) {
                        result = {
                          ok: false,
                          error: "auth_required",
                          message: "You need a write-tier API key before I can apply edits.",
                          cta: "/settings/api-keys?source=workbench",
                        }
                      } else {
                        result = await executeApplyEdit(editDeps, toolUse.input as never)
                      }
                    } else {
                      result = { error: "unknown_edit_tool", name: toolUse.name }
                    }
                  } catch (err) {
                    result = {
                      error: "tool_execution_failed",
                      detail: err instanceof Error ? err.message : String(err),
                    }
                  }
                  // Surface the result to the client UI so the canvas can
                  // render a ConfirmationCard when propose_edit fires and
                  // a "mutation live" notice when apply_edit succeeds.
                  // Sanitized: result is sourced from our own executor output.
                  controller.enqueue(sseEvent(encoder, {
                    type: "edit_tool_result",
                    tool_use_id: toolUse.id,
                    name: toolUse.name,
                    result,
                  }))
                  return {
                    type: "tool_result" as const,
                    tool_use_id: toolUse.id,
                    content: capToolResultContent(JSON.stringify(result)),
                  }
                }
                // Server-side API tools: dispatch to FestivusClient (or the
                // mock when X-Test-Mock-Client is set) and return data.
                if (API_TOOL_NAMES.has(toolUse.name)) {
                  // Capture the exact URLs FestivusClient hits during this
                  // tool call so the workbench can show them in the
                  // "Show process" disclosure. Scoped per tool_use so
                  // concurrent tool calls don't cross-contaminate. The mock
                  // client used by persona tests has no onRequest hook, so
                  // `capturedUrls` stays empty in that mode — which is fine,
                  // tests don't assert on urls.
                  const capturedUrls: string[] = []
                  const callClient: IFestivusClient =
                    apiClient ?? new FestivusClient({ onRequest: (u) => capturedUrls.push(u) })
                  const apiStart = Date.now()
                  const payload = await callApiTool(
                    toolUse.name,
                    toolUse.input as Record<string, unknown>,
                    { client: callClient },
                  )
                  const apiEnd = Date.now()
                  controller.enqueue(sseEvent(encoder, {
                    type: "api_tool_called",
                    name: toolUse.name,
                    input: toolUse.input,
                    urls: capturedUrls,
                    duration_ms: apiEnd - apiStart,
                  }))
                  sink.emit(
                    createApiToolCalled({
                      t: apiEnd,
                      request_id,
                      name: toolUse.name,
                      arguments: toolUse.input,
                      result_preview: payload,
                      duration_ms: apiEnd - apiStart,
                    }),
                  )
                  if (toolUse.name === "search_robots" && !payload.startsWith('{"count":0') && !payload.startsWith('{"error":')) {
                    searchRobotsHadCandidates = true
                  }
                  return {
                    type: "tool_result" as const,
                    tool_use_id: toolUse.id,
                    content: capToolResultContent(withRenderReminder(toolUse.name, payload)),
                  }
                }
                // Canvas tools: nudge the model on the LAST canvas tool only.
                if (toolUse === toolUseBlocks[toolUseBlocks.length - 1] && (hasExplorationNodes && !askedUser || needsDeployment)) {
                  const nudges: string[] = ["Done."]
                  if (needsDeployment) {
                    nudges.push("MANDATORY: You added robot nodes but have NOT sent a show_agent_message with specialist='deployment'. You MUST do this now.")
                  }
                  if (hasExplorationNodes && !askedUser) {
                    nudges.push("You populated an exploration lane. You MUST call show_agent_message (summary) and then ask_user (with 4-5 options) before ending.")
                  }
                  return {
                    type: "tool_result" as const,
                    tool_use_id: toolUse.id,
                    content: nudges.join(" "),
                  }
                }
                return {
                  type: "tool_result" as const,
                  tool_use_id: toolUse.id,
                  content: "Done",
                }
              }))

              messages.push({ role: "user", content: toolResults })
            } else {
              break
            }

            // Post-turn retry guard: if we've used up most of the budget
            // with search_robots calls but never got around to add_node,
            // inject the nudge now while there's still a turn left.
            const hasRobotNodesSoFar = addedNodeTypes.includes("robot")
            if (
              searchRobotsHadCandidates
              && !hasRobotNodesSoFar
              && !silentEndRetryUsed
              && turnCount >= MAX_TURNS - 5
            ) {
              silentEndRetryUsed = true
              messages.push({
                role: "user",
                content: "[SILENT-END RETRY] You have called search_robots multiple times in this conversation and received real candidates (see the tool_result JSON in prior turns), but you have not emitted a single add_node(node_type=\"robot\") call yet. You are almost out of turns. In your NEXT assistant message you MUST emit, in a SINGLE response (do NOT spread this across multiple turns — emit all tool calls in one content block list): (1) add_node(node_type=\"robot\", exploration_group=\"robots-1\") for up to 10 of the best candidates from your prior search_robots results — re-read the tool_result JSON above and pick from it, you already have the data; (2) show_agent_message(specialist=\"hardware\") comparing them in 2-4 sentences; (3) show_agent_message(specialist=\"deployment\") annotating safety; (4) ask_user with 4-5 follow-up options. If you truly cannot find any relevant matches, emit show_agent_message(specialist=\"hardware\") explaining the gap and then ask_user to pivot. STOP calling search_robots — you already have the data you need. Emit all tool calls in this next response.",
              })
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          controller.enqueue(sseEvent(encoder, { type: "error", error: errorMessage }))
        }

        // GUARANTEED FALLBACK: Hardware Scout summary — fires before deployment
        // so the sidebar order stays Hardware → Deploy → ask_user
        const hasRobotNodesGlobal = addedNodeTypes.includes("robot")
        if (hasRobotNodesGlobal && !hasHardwareMessage) {
          controller.enqueue(sseEvent(encoder, buildFallbackHardwareSummary(addedNodeNames)))
        }

        // GUARANTEED FALLBACK: Deployment annotation
        if (hasRobotNodesGlobal && !hasDeploymentMessage) {
          controller.enqueue(sseEvent(encoder, buildFallbackDeployment(addedNodeNames)))
        }

        // GUARANTEED FALLBACK: ask_user
        const hasLaneNodes = addedNodeTypes.some((t) => t === "robot" || t === "policy" || t === "environment")
        if (!askedUser && hasLaneNodes) {
          controller.enqueue(sseEvent(encoder, buildFallbackAskUser(addedNodeTypes, addedNodeNames)))
        }

        const finishedAt = Date.now()
        sink.emit(
          createRequestEnd({
            t: finishedAt,
            request_id,
            duration_ms: finishedAt - startedAt,
            input_tokens: totalInputTokens,
            output_tokens: totalOutputTokens,
          }),
        )
        await sink.close()

        controller.enqueue(sseEvent(encoder, { type: "done" }))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
