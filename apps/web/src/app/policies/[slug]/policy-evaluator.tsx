"use client"

import { useState } from "react"
import type {
  ICompatibilityCheckStatus,
  IEvaluationConfig,
  IRichPolicy,
} from "@festivus/types"

interface IPolicyEvaluatorProps {
  policy: IRichPolicy
  config: IEvaluationConfig
}

type Step = "select-robot" | "select-env" | "results"

// ── Arrow ───────────────────────────────────────────────────────────

function HArrow({ status }: { status?: ICompatibilityCheckStatus }) {
  const color =
    status === "compatible"
      ? "text-green-600"
      : status === "partial"
        ? "text-yellow-600"
        : status === "incompatible"
          ? "text-annotation-red"
          : "text-blueprint-navy/20"
  return (
    <div className="flex shrink-0 items-center">
      <div className={`h-px w-10 bg-current ${color} lg:w-16`} />
      <svg className={`-ml-1 h-3 w-3 ${color}`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M14 10l-5-5v10l5-5z" />
      </svg>
    </div>
  )
}

// ── Canvas Card ─────────────────────────────────────────────────────

function Card({
  active,
  borderColor,
  children,
  dashed,
  label,
}: {
  active?: boolean
  borderColor?: string
  children: React.ReactNode
  dashed?: boolean
  label: string
}) {
  const border = borderColor ?? "border-blueprint-navy/30"
  return (
    <div
      className={`bg-white w-52 shrink-0 rounded-lg p-4 shadow-lg transition-all duration-300 ${
        dashed === true ? `border-2 border-dashed ${border}` : `border-2 ${border}`
      } ${active === true ? "ring-safety-yellow ring-2 ring-offset-2" : ""}`}
    >
      <p className="text-blueprint-navy/60 mb-2 text-[12px] font-bold uppercase tracking-[0.15em]">
        {label}
      </p>
      {children}
    </div>
  )
}

// ── Compatibility badge helpers ─────────────────────────────────────

function statusBorder(s?: ICompatibilityCheckStatus): string {
  if (s === "compatible") return "border-green-600"
  if (s === "partial") return "border-yellow-600"
  if (s === "incompatible") return "border-annotation-red"
  return "border-blueprint-navy/30"
}

function CheckRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <p className="text-xs leading-relaxed">
      <span className={passed ? "text-green-600" : "text-annotation-red"}>
        {passed ? "✓" : "✗"}
      </span>{" "}
      <span className="text-blueprint-navy/70">{label}</span>
    </p>
  )
}

// ── Guide message type ──────────────────────────────────────────────

interface IGuideMessage {
  text: string
  options?: { label: string; sublabel?: string; onClick: () => void }[]
}

// ── Main Component ──────────────────────────────────────────────────

export function PolicyEvaluator({ policy, config }: IPolicyEvaluatorProps) {
  const [step, setStep] = useState<Step>("select-robot")
  const [selectedRobotSlug, setSelectedRobotSlug] = useState<string | null>(null)
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null)
  const [showAllRobots, setShowAllRobots] = useState(false)

  const selectedRobot = selectedRobotSlug !== null
    ? config.robots.find((r) => r.robotSlug === selectedRobotSlug) ?? null
    : null
  const selectedEnv = selectedEnvId !== null
    ? config.environments.find((e) => e.id === selectedEnvId) ?? null
    : null
  const selectedResult = selectedRobot !== null && selectedEnvId !== null
    ? selectedRobot.environments.find((e) => e.environmentId === selectedEnvId)?.result ?? null
    : null

  function handleSelectRobot(slug: string) {
    const robot = config.robots.find((r) => r.robotSlug === slug)
    if (robot === undefined) return
    setSelectedRobotSlug(slug)
    setSelectedEnvId(null)
    setStep(robot.compatibility.status === "incompatible" ? "select-robot" : "select-env")
  }

  function handleSelectEnv(envId: string) {
    setSelectedEnvId(envId)
    setStep("results")
  }

  function handleReset() {
    setSelectedRobotSlug(null)
    setSelectedEnvId(null)
    setStep("select-robot")
    setShowAllRobots(false)
  }

  // ── Build guide messages ──────────────────────────────────────────

  const messages: IGuideMessage[] = []
  const compatibleRobots = config.robots.filter((r) => r.compatibility.status !== "incompatible")
  const displayRobots = showAllRobots ? config.robots : config.robots.slice(0, 4)

  messages.push({
    text: `You're looking at ${policy.name}.\n\nWhat robot do you have?`,
    options: step === "select-robot"
      ? [
          ...displayRobots.map((r) => ({
            label: r.robotName,
            sublabel:
              r.compatibility.status === "compatible"
                ? "Compatible"
                : r.compatibility.status === "partial"
                  ? "Partial"
                  : "Incompatible",
            onClick: () => handleSelectRobot(r.robotSlug),
          })),
          ...(!showAllRobots && config.robots.length > 4
            ? [{ label: "Show all", onClick: () => setShowAllRobots(true) }]
            : []),
        ]
      : undefined,
  })

  if (selectedRobot !== null) {
    if (selectedRobot.compatibility.status === "incompatible") {
      messages.push({
        text: `${policy.name} won't work on ${selectedRobot.robotName}.\n\n${selectedRobot.compatibility.reason ?? "Incompatible hardware."}`,
        options: [
          ...compatibleRobots.map((r) => ({
            label: r.robotName,
            sublabel: r.compatibility.status,
            onClick: () => handleSelectRobot(r.robotSlug),
          })),
          { label: "Start over", onClick: handleReset },
        ],
      })
    } else {
      const envOptions = selectedRobot.environments.map((e) => {
        const env = config.environments.find((env) => env.id === e.environmentId)
        return {
          label: env?.name ?? e.environmentId,
          sublabel: e.result !== undefined ? `${e.result.successRate}% success` : "No data yet",
          onClick: () => handleSelectEnv(e.environmentId),
        }
      })

      messages.push({
        text: `Got it, ${selectedRobot.robotName}.${selectedRobot.compatibility.reason !== undefined ? `\n\n${selectedRobot.compatibility.reason}` : ""}\n\nPick an environment:`,
        options: step === "select-env"
          ? [...envOptions, { label: "Switch robot", onClick: handleReset }]
          : undefined,
      })
    }
  }

  if (step === "results" && selectedRobot !== null && selectedEnv !== null) {
    messages.push({
      text: selectedResult !== null
        ? `Results for ${selectedRobot.robotName} in ${selectedEnv.name}:`
        : `No data for ${selectedRobot.robotName} in ${selectedEnv.name}.`,
      options: [
        { label: "Try another environment", onClick: () => { setSelectedEnvId(null); setStep("select-env") } },
        { label: "Try another robot", onClick: handleReset },
      ],
    })
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Canvas — full space, cards floating horizontally centered */}
      <div className="relative flex flex-1 items-center justify-center overflow-x-auto p-8 lg:p-12">
        {/* Dot grid background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(11,28,54,0.07) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Card flow */}
        <div className="relative z-10 flex items-center gap-0">
          {/* Policy */}
          <Card label="Policy">
            <p className="text-blueprint-navy text-sm font-bold leading-tight">{policy.name}</p>
            <p className="text-blueprint-navy/60 mt-1.5 text-[14px] leading-snug">{policy.taskDescription}</p>
            <div className="mt-2 flex gap-1.5">
              <span className="bg-blueprint-navy/5 text-blueprint-navy/60 rounded px-1.5 py-0.5 text-[12px]">
                {policy.framework}
              </span>
              <span className="bg-blueprint-navy/5 text-blueprint-navy/60 rounded px-1.5 py-0.5 text-[12px]">
                {policy.skillType}
              </span>
            </div>
          </Card>

          <HArrow status={selectedRobot?.compatibility.status} />

          {/* Robot */}
          {selectedRobot !== null ? (
            <Card
              active
              borderColor={statusBorder(selectedRobot.compatibility.status)}
              label="Robot"
            >
              <p className="text-blueprint-navy text-sm font-bold">{selectedRobot.robotName}</p>
              <div className="mt-2 space-y-0.5">
                <CheckRow label="Action space" passed={selectedRobot.compatibility.actionSpaceMatch} />
                <CheckRow label="Frequency" passed={selectedRobot.compatibility.controlFrequencyMatch} />
              </div>
            </Card>
          ) : (
            <Card dashed label="Robot">
              <p className="text-blueprint-navy/50 text-xs">Select from guide</p>
            </Card>
          )}

          <HArrow
            status={
              selectedRobot?.compatibility.status === "incompatible"
                ? "incompatible"
                : selectedEnv !== null ? "compatible" : undefined
            }
          />

          {/* Environment */}
          {selectedEnv !== null ? (
            <Card label="Environment">
              <p className="text-blueprint-navy text-sm font-bold">{selectedEnv.name}</p>
              <p className="text-blueprint-navy/60 mt-1 text-[14px]">{selectedEnv.description}</p>
              <span className="bg-blueprint-navy/5 text-blueprint-navy/60 mt-2 inline-block rounded px-1.5 py-0.5 text-[12px]">
                {selectedEnv.simulator}
              </span>
            </Card>
          ) : (
            <Card dashed label="Environment">
              <p className="text-blueprint-navy/50 text-xs">
                {selectedRobot?.compatibility.status === "incompatible"
                  ? "Incompatible"
                  : "Select from guide"}
              </p>
            </Card>
          )}

          <HArrow status={selectedResult !== null ? "compatible" : undefined} />

          {/* Results */}
          {step === "results" && selectedResult !== null ? (
            <Card borderColor="border-green-600" label="Results">
              {selectedResult.videoUrl !== undefined ? (
                <div className="mb-2 aspect-video overflow-hidden rounded">
                  <iframe
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    className="h-full w-full"
                    src={selectedResult.videoUrl}
                    title="Result video"
                  />
                </div>
              ) : null}
              <p className="text-blueprint-navy text-3xl font-bold leading-none">
                {selectedResult.successRate}%
              </p>
              <p className="text-blueprint-navy/60 mt-1 text-[14px]">
                {selectedResult.episodes.toLocaleString()} episodes
              </p>
              {selectedResult.failureModes.length > 0 ? (
                <div className="border-blueprint-navy/10 mt-2 border-t pt-2">
                  {selectedResult.failureModes.slice(0, 2).map((f, i) => (
                    <p className="text-blueprint-navy/60 text-[13px] leading-relaxed" key={i}>· {f}</p>
                  ))}
                </div>
              ) : null}
            </Card>
          ) : step === "results" ? (
            <Card dashed label="Results">
              <p className="text-blueprint-navy text-sm font-bold">Not tested</p>
              <p className="text-blueprint-navy/50 mt-1 text-[14px]">No data for this combo</p>
            </Card>
          ) : (
            <Card dashed label="Results">
              <p className="text-blueprint-navy/50 text-xs">Awaiting selection</p>
            </Card>
          )}
        </div>
      </div>

      {/* Guide Panel — pinned right */}
      <div className="border-blueprint-navy/10 bg-white flex w-full flex-col border-t lg:w-80 lg:border-t-0 lg:border-l">
        <div className="border-blueprint-navy/10 border-b px-5 py-4">
          <p className="text-blueprint-navy text-xs font-bold uppercase tracking-wider">Guide</p>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.map((msg, i) => (
            <div key={i}>
              <p className="text-blueprint-navy whitespace-pre-line text-sm leading-relaxed">
                {msg.text}
              </p>
              {msg.options !== undefined ? (
                <div className="mt-3 space-y-1.5">
                  {msg.options.map((opt) => (
                    <button
                      className="border-blueprint-navy/15 hover:border-blueprint-navy hover:bg-blueprint-navy hover:text-white w-full cursor-pointer rounded-lg border px-4 py-3 text-left transition-all duration-150"
                      key={opt.label}
                      onClick={opt.onClick}
                      type="button"
                    >
                      <span className="block text-xs font-bold">{opt.label}</span>
                      {opt.sublabel !== undefined ? (
                        <span className="mt-0.5 block text-[13px] opacity-60">{opt.sublabel}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
