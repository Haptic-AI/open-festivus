/**
 * Pure event constructors for the agent trace. One per event type,
 * no I/O, no clock reads — caller provides t and request_id.
 *
 * The CONSTRUCTOR_REGISTRY at the bottom is pinned via
 * `satisfies Record<TraceEventType, ...>` so adding a new type to the
 * union without registering a constructor fails at compile time.
 */

import type {
  IAgentTraceEvent,
  IApiToolCalledEvent,
  IAssistantMessageChunkEvent,
  ICanvasToolCalledEvent,
  IRequestEndEvent,
  IRequestStartEvent,
  IRouterClassifiedEvent,
  ISpecialistActivatedEvent,
  TraceEventType,
} from "./types"

export { TRACE_EVENT_TYPES } from "./types"

interface IBaseInput {
  t: number
  request_id: string
}

export interface IRequestStartInput extends IBaseInput {
  system: string
  model: string
  question: string
}

export function createRequestStart(input: IRequestStartInput): IRequestStartEvent {
  return {
    type: "request_start",
    t: input.t,
    request_id: input.request_id,
    gen_ai: {
      system: input.system,
      request: { model: input.model },
    },
    festivus: {
      question: { text: input.question },
    },
  }
}

export interface IRouterClassifiedInput extends IBaseInput {
  shape: string
  confidence: number
}

export function createRouterClassified(input: IRouterClassifiedInput): IRouterClassifiedEvent {
  return {
    type: "router_classified",
    t: input.t,
    request_id: input.request_id,
    festivus: {
      router: { shape: input.shape, confidence: input.confidence },
    },
  }
}

export interface IApiToolCalledInput extends IBaseInput {
  name: string
  arguments: unknown
  result_preview: string
  duration_ms: number
}

export function createApiToolCalled(input: IApiToolCalledInput): IApiToolCalledEvent {
  return {
    type: "api_tool_called",
    t: input.t,
    request_id: input.request_id,
    gen_ai: {
      tool: {
        name: input.name,
        call: {
          arguments: input.arguments,
          result_preview: input.result_preview,
        },
      },
    },
    duration_ms: input.duration_ms,
  }
}

export interface ICanvasToolCalledInput extends IBaseInput {
  name: string
  arguments: unknown
}

export function createCanvasToolCalled(input: ICanvasToolCalledInput): ICanvasToolCalledEvent {
  return {
    type: "canvas_tool_called",
    t: input.t,
    request_id: input.request_id,
    gen_ai: {
      tool: {
        name: input.name,
        call: { arguments: input.arguments },
      },
    },
  }
}

export interface ISpecialistActivatedInput extends IBaseInput {
  specialist: string
}

export function createSpecialistActivated(
  input: ISpecialistActivatedInput,
): ISpecialistActivatedEvent {
  return {
    type: "specialist_activated",
    t: input.t,
    request_id: input.request_id,
    festivus: {
      specialist: { name: input.specialist },
    },
  }
}

export interface IAssistantMessageChunkInput extends IBaseInput {
  index: number
  bytes: number
  text: string
}

export function createAssistantMessageChunk(
  input: IAssistantMessageChunkInput,
): IAssistantMessageChunkEvent {
  return {
    type: "assistant_message_chunk",
    t: input.t,
    request_id: input.request_id,
    festivus: {
      chunk: { index: input.index, bytes: input.bytes, text: input.text },
    },
  }
}

export interface IRequestEndInput extends IBaseInput {
  duration_ms: number
  input_tokens: number
  output_tokens: number
}

export function createRequestEnd(input: IRequestEndInput): IRequestEndEvent {
  return {
    type: "request_end",
    t: input.t,
    request_id: input.request_id,
    duration_ms: input.duration_ms,
    gen_ai: {
      usage: {
        input_tokens: input.input_tokens,
        output_tokens: input.output_tokens,
      },
    },
  }
}

export const CONSTRUCTOR_REGISTRY = {
  request_start: createRequestStart,
  router_classified: createRouterClassified,
  api_tool_called: createApiToolCalled,
  canvas_tool_called: createCanvasToolCalled,
  specialist_activated: createSpecialistActivated,
  assistant_message_chunk: createAssistantMessageChunk,
  request_end: createRequestEnd,
} satisfies Record<TraceEventType, (input: never) => IAgentTraceEvent>
