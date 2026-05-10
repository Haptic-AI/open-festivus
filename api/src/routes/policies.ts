import { Router } from "express"
import type { IRepository } from "../repo/types.js"
import { buildDomainRouter } from "./_factory.js"

export function buildPoliciesRouter(repo: IRepository): Router {
  return buildDomainRouter("policies", repo)
}
