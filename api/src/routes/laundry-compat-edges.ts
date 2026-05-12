import { Router } from "express"
import type { IRepository } from "../repo/types.js"
import { buildDomainRouter } from "./_factory.js"

export function buildLaundryCompatEdgesRouter(repo: IRepository): Router {
  return buildDomainRouter("laundry_compat_edges", repo)
}
