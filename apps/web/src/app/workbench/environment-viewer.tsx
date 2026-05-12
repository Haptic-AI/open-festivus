"use client"

import { useCallback, useEffect, useState } from "react"
import type { IEnvOption } from "@/data/workbench-data"

interface IEnvironmentViewerProps {
  env: IEnvOption
  breadcrumb: { robot?: string; task?: string; policy?: string }
  onClose: () => void
}

type Condition = "bright" | "dim" | "variable"
type Clutter = "none" | "light" | "heavy"

// Map env + conditions to video URLs. MVP: same video, different label.
// The MuJoCo native viewer video works for all conditions.
const VIDEO_URL = "https://www.youtube.com/embed/P83tKA1iz2Y?autoplay=1&loop=1&mute=1&controls=0&showinfo=0"

export function EnvironmentViewer({ env, breadcrumb, onClose }: IEnvironmentViewerProps) {
  const [visible, setVisible] = useState(false)
  const [lighting, setLighting] = useState<Condition>("bright")
  const [clutter, setClutter] = useState<Clutter>("none")
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptValue, setPromptValue] = useState("")
  const [agentResponse, setAgentResponse] = useState<string | null>(null)

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 300)
  }, [onClose])

  // Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [handleClose])

  // Scripted agent responses
  function handlePromptSubmit() {
    if (promptValue.trim().length === 0) return
    const q = promptValue.toLowerCase()
    if (q.includes("big") || q.includes("size")) {
      setAgentResponse(`${env.name} is a standard ${env.simulator} scene. Workspace dimensions are approximately 2m x 1.5m x 1m.`)
    } else if (q.includes("object") || q.includes("table")) {
      setAgentResponse("The scene contains randomized rigid objects on a flat surface. Object sizes range from 2cm to 8cm.")
    } else if (q.includes("reach") || q.includes("robot")) {
      setAgentResponse("A 6-DoF arm with 400mm reach can access the full workspace. Taller shelves may require a longer reach arm.")
    } else {
      setAgentResponse(`I can answer questions about ${env.name} once connected to a real agent. For now, try asking about size, objects, or robot reach.`)
    }
    setPromptValue("")
    setShowPrompt(true)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col transition-all duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Dark background with video */}
      <div className="relative flex-1 bg-black">
        {/* Video fills viewport */}
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className="absolute inset-0 h-full w-full"
          src={VIDEO_URL}
          title={env.name}
        />

        {/* Overlay gradient for readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

        {/* Top left: logo / back */}
        <button
          className="absolute top-5 left-5 z-10 cursor-pointer text-white/70 transition-colors hover:text-white"
          onClick={handleClose}
          type="button"
        >
          <span className="text-sm font-bold uppercase tracking-[0.2em]">Festivus</span>
        </button>

        {/* Top right: share */}
        <button
          className="absolute top-5 right-5 z-10 cursor-pointer rounded-full bg-white/10 p-2 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
          type="button"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Bottom left: attribution */}
        <div className="absolute bottom-5 left-5 z-10">
          <p className="text-white/50 text-xs">
            Created by {env.simulator === "MuJoCo" ? "Google DeepMind" : env.simulator === "Isaac Sim" ? "NVIDIA" : "Community"} | {env.simulator}
          </p>
        </div>

        {/* Bottom center: environment name */}
        <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2">
          <p className="text-lg font-bold text-white">{env.name}</p>
          <p className="text-center text-xs text-white/50">{env.description}</p>
        </div>

        {/* Bottom right: controls */}
        <div className="absolute bottom-5 right-5 z-10 flex items-center gap-2">
          <button className="rounded-full bg-white/10 p-2 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20" type="button">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="rounded-full bg-white/10 p-2 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20" type="button">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>

        {/* Condition toggles */}
        <div className="absolute top-5 left-1/2 z-10 -translate-x-1/2">
          <div className="flex gap-1 rounded-full bg-black/40 p-1 backdrop-blur-sm">
            {(["bright", "dim", "variable"] as const).map((l) => (
              <button
                className={`cursor-pointer rounded-full px-3 py-1 text-[13px] font-bold transition-colors ${
                  lighting === l ? "bg-white text-black" : "text-white/60 hover:text-white"
                }`}
                key={l}
                onClick={() => setLighting(l)}
                type="button"
              >
                {l}
              </button>
            ))}
            <div className="mx-1 w-px bg-white/20" />
            {(["none", "light", "heavy"] as const).map((c) => (
              <button
                className={`cursor-pointer rounded-full px-3 py-1 text-[13px] font-bold transition-colors ${
                  clutter === c ? "bg-white text-black" : "text-white/60 hover:text-white"
                }`}
                key={c}
                onClick={() => setClutter(c)}
                type="button"
              >
                {c === "none" ? "clean" : c}
              </button>
            ))}
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="absolute top-14 left-5 z-10 flex items-center gap-2 text-[13px] text-white/40">
          {breadcrumb.robot !== undefined ? (
            <>
              <button className="hover:text-white/70 transition-colors" onClick={handleClose} type="button">{breadcrumb.robot}</button>
              <span>›</span>
            </>
          ) : null}
          {breadcrumb.task !== undefined ? (
            <>
              <button className="hover:text-white/70 transition-colors" onClick={handleClose} type="button">{breadcrumb.task}</button>
              <span>›</span>
            </>
          ) : null}
          {breadcrumb.policy !== undefined ? (
            <>
              <button className="hover:text-white/70 transition-colors" onClick={handleClose} type="button">{breadcrumb.policy}</button>
              <span>›</span>
            </>
          ) : null}
          <span className="font-bold text-white/70">{env.name}</span>
        </div>

        {/* Floating prompt pill */}
        <div className="absolute bottom-16 left-1/2 z-10 w-full max-w-md -translate-x-1/2 px-4">
          {agentResponse !== null && showPrompt ? (
            <div className="mb-2 rounded-lg bg-black/60 px-4 py-3 text-xs text-white/80 backdrop-blur-sm">
              {agentResponse}
            </div>
          ) : null}
          <div className="flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 backdrop-blur-sm">
            <input
              autoComplete="off"
              className="flex-1 bg-transparent text-xs text-white placeholder:text-white/40 outline-none"
              onChange={(e) => setPromptValue(e.target.value)}
              onFocus={() => setShowPrompt(true)}
              onKeyDown={(e) => { if (e.key === "Enter") handlePromptSubmit() }}
              placeholder="Ask anything about this environment..."
              type="text"
              value={promptValue}
            />
            <button
              className="cursor-pointer text-white/50 transition-colors hover:text-white"
              onClick={handlePromptSubmit}
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
