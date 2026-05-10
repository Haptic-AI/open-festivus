import { Router } from "express"
import type { IRepository } from "../repo/types.js"
import { buildDomainRouter } from "./_factory.js"

export function buildDeployNotesRouter(repo: IRepository): Router {
  return buildDomainRouter("deploy_notes", repo)
}
