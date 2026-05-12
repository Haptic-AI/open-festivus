/**
 * Record lookups for /data profile relationship sections.
 * Pure server-only helpers. Used to resolve slugs → display names
 * so a profile can render linked pills without duplicating data.
 */

import type { IPolicyEntry, IRobotEntry } from "@/data/seed/types"
import robotsJson from "@/data/seed/robots.json"
import policiesJson from "@/data/seed/policies.json"
import datasetsJson from "@/data/seed/datasets.json"
import { ALL_ENVIRONMENTS } from "@/data/explore-data"
import type { IRichDataset, ISimEnvironment } from "@festivus/types"

const ROBOTS = robotsJson as IRobotEntry[]
const POLICIES = policiesJson as unknown as IPolicyEntry[]
const DATASETS = datasetsJson as unknown as IRichDataset[]

export interface IRelatedItem {
  slug: string
  name: string
  href: string
  subtitle?: string
}

export function robotsFromSlugs(slugs: string[]): IRelatedItem[] {
  return slugs
    .map((slug): IRelatedItem | null => {
      const robot = ROBOTS.find((r) => r.slug === slug)
      if (robot === undefined) {
        return { slug, name: slug, href: `/data/robots/${slug}`, subtitle: "not in seed" }
      }
      return {
        slug,
        name: robot.name,
        href: `/data/robots/${slug}`,
        subtitle: robot.manufacturer,
      }
    })
    .filter((x): x is IRelatedItem => x !== null)
}

export function policiesFromSlugs(slugs: string[]): IRelatedItem[] {
  return slugs.map((slug): IRelatedItem => {
    const policy = POLICIES.find((p) => p.slug === slug)
    if (policy === undefined) {
      return { slug, name: slug, href: `/data/policies/${slug}`, subtitle: "not in seed" }
    }
    return {
      slug,
      name: policy.name,
      href: `/data/policies/${slug}`,
      subtitle: policy.framework,
    }
  })
}

export function datasetsFromSlugs(slugs: string[]): IRelatedItem[] {
  return slugs.map((slug): IRelatedItem => {
    const dataset = DATASETS.find((d) => d.slug === slug)
    if (dataset === undefined) {
      return { slug, name: slug, href: `/data/datasets/${slug}`, subtitle: "not in seed" }
    }
    return {
      slug,
      name: dataset.name,
      href: `/data/datasets/${slug}`,
      subtitle: dataset.source,
    }
  })
}

/** Environments are keyed by id, not slug (see explore-data.ts). */
export function environmentsFromSlugs(idsOrSlugs: string[]): IRelatedItem[] {
  return idsOrSlugs.map((s): IRelatedItem => {
    // Try id first, then a scene match as fallback for seed slugs.
    const env: ISimEnvironment | undefined =
      ALL_ENVIRONMENTS.find((e) => e.id === s) ?? ALL_ENVIRONMENTS.find((e) => e.scene === s)
    if (env === undefined) {
      return { slug: s, name: s, href: `/data/environments/${s}`, subtitle: "not in seed" }
    }
    return {
      slug: env.id,
      name: env.name,
      href: `/data/environments/${env.id}`,
      subtitle: `${env.simulator} · ${env.scene}`,
    }
  })
}

/** Robots that list the given policy slug in their compatible_policy_slugs. */
export function robotsByCompatiblePolicy(policySlug: string): IRelatedItem[] {
  return ROBOTS.filter((r) => r.compatible_policy_slugs.includes(policySlug)).map((r) => ({
    slug: r.slug,
    name: r.name,
    href: `/data/robots/${r.slug}`,
    subtitle: r.manufacturer,
  }))
}

/** Datasets whose compatible_policy_slugs include the given policy. */
export function datasetsByCompatiblePolicy(policySlug: string): IRelatedItem[] {
  return DATASETS.filter((d) => {
    const compat = (d as unknown as { compatiblePolicySlugs?: string[]; policySlug?: string })
    if (compat.policySlug === policySlug) return true
    if (compat.compatiblePolicySlugs !== undefined) return compat.compatiblePolicySlugs.includes(policySlug)
    return false
  }).map((d) => ({
    slug: d.slug,
    name: d.name,
    href: `/data/datasets/${d.slug}`,
    subtitle: d.source,
  }))
}

/** Robots whose compatible_env_slugs include the given environment id/scene. */
export function robotsByCompatibleEnv(envIdOrScene: string): IRelatedItem[] {
  return ROBOTS.filter(
    (r) => r.compatible_env_slugs.includes(envIdOrScene)
  ).map((r) => ({
    slug: r.slug,
    name: r.name,
    href: `/data/robots/${r.slug}`,
    subtitle: r.manufacturer,
  }))
}
