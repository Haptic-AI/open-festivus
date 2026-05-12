import { Router } from "express"
import type { IRepository } from "../repo/types.js"
import { buildDomainRouter } from "./_factory.js"

export function buildPapersRouter(repo: IRepository): Router {
  return buildDomainRouter("papers", repo)
}
