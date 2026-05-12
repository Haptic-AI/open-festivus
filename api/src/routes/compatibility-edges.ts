import { Router } from "express"
import type { IRepository } from "../repo/types.js"
import { buildDomainRouter } from "./_factory.js"

export function buildCompatibilityEdgesRouter(repo: IRepository): Router {
  return buildDomainRouter("compatibility_edges", repo)
}
