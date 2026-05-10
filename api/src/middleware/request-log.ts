import type { NextFunction, Request, Response } from "express"
import "./request-augmentation.js"

export interface IRequestLogLine {
  method: string
  path: string
  status: number
  duration_ms: number
  tier: string
}

export interface IRequestLogOptions {
  log?: (line: IRequestLogLine) => void
}

const defaultLog = (line: IRequestLogLine): void => {
  console.warn(JSON.stringify(line))
}

export function requestLogMiddleware(options: IRequestLogOptions = {}) {
  const log = options.log ?? defaultLog
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now()
    res.on("finish", () => {
      log({
        method: req.method,
        path: req.originalUrl ?? req.url,
        status: res.statusCode,
        duration_ms: Date.now() - start,
        tier: req.tier ?? "unknown",
      })
    })
    next()
  }
}
