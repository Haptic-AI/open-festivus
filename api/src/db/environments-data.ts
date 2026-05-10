// Static import of data/environments.json so the Vercel bundler traces the file
// (G3). Both bootstraps (`src/index.ts` for local dev and `api/api/index.ts` for
// Vercel) consume this module so there is exactly one loader path.
import type { IEnvironment } from "@festivus/types"
import envs from "../../../data/environments.json" with { type: "json" }

export const environments: IEnvironment[] = envs as IEnvironment[]
