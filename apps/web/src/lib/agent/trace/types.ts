/**
 * Agent trace event taxonomy and sink interface.
 *
 * Field naming follows OpenTelemetry GenAI semantic conventions for
 * LLM-generic fields (gen_ai.*) and a festivus.* prefix for
 * project-specific fields. See specs/014-agent-trace-observability.md.
 */

export const TRACE_EVENT_TYPES = [
  "request_start",
  "router_classified",
  "api_tool_called",
  "canvas_tool_called",
  "specialist_activated",
  "assistant_message_chunk",
  "request_end",
] as const

export type TraceEventType = (typeof TRACE_EVENT_TYPES)[number]

interface ITraceEventBase {
  t: number
  request_id: string
}

export interface IRequestStartEvent extends ITraceEventBase {
  type: "request_start"
  gen_ai: {
    system: string
    request: { model: string }
  }
  festivus: {
    question: { text: string }
  }
}

export interface IRouterClassifiedEvent extends ITraceEventBase {
  type: "router_classified"
  festivus: {
    router: { shape: string; confidence: number }
  }
}

export interface IApiToolCalledEvent extends ITraceEventBase {
  type: "api_tool_called"
  gen_ai: {
    tool: {
      name: string
      call: {
        arguments: unknown
        result_preview: string
      }
    }
  }
  duration_ms: number
}

export interface ICanvasToolCalledEvent extends ITraceEventBase {
  type: "canvas_tool_called"
  gen_ai: {
    tool: {
      name: string
      call: { arguments: unknown }
    }
  }
}

export interface ISpecialistActivatedEvent extends ITraceEventBase {
  type: "specialist_activated"
  festivus: {
    specialist: { name: string }
  }
}

export interface IAssistantMessageChunkEvent extends ITraceEventBase {
  type: "assistant_message_chunk"
  festivus: {
    chunk: { index: number; bytes: number; text: string }
  }
}

export interface IRequestEndEvent extends ITraceEventBase {
  type: "request_end"
  duration_ms: number
  gen_ai: {
    usage: { input_tokens: number; output_tokens: number }
  }
}

export type IAgentTraceEvent =
  | IRequestStartEvent
  | IRouterClassifiedEvent
  | IApiToolCalledEvent
  | ICanvasToolCalledEvent
  | ISpecialistActivatedEvent
  | IAssistantMessageChunkEvent
  | IRequestEndEvent

export interface ITraceSink {
  emit(event: IAgentTraceEvent): void
  close(): Promise<void>
}
