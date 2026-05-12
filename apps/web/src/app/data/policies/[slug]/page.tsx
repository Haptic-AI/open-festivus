import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { IPolicy } from "@festivus/types"
import { AskAIButton } from "@/components/agent-chat/AskAIButton"
import { ProfileLayout } from "@/components/data-profile/profile-layout"
import { ProfileField } from "@/components/data-profile/profile-field"
import { RelatedList } from "@/components/data-profile/related-list"
import {
  datasetsByCompatiblePolicy,
  environmentsFromSlugs,
  robotsFromSlugs,
} from "@/lib/data/lookups"
import { FestivusClient } from "@/lib/api/festivus-client"

export const dynamicParams = true

async function findPolicy(slug: string): Promise<IPolicy | null> {
  return new FestivusClient().getPolicy(slug)
}

interface IPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: IPageProps): Promise<Metadata> {
  const { slug } = await params
  const policy = await findPolicy(slug)
  if (policy === null) return { title: "Not found | Festivus" }
  return {
    title: `${policy.name} · policy | Festivus`,
    description: policy.task_description.slice(0, 160),
  }
}

export default async function PolicyProfilePage({ params }: IPageProps) {
  const { slug } = await params
  const policy = await findPolicy(slug)
  if (policy === null) notFound()

  return (
    <ProfileLayout
      recordId={policy.slug}
      recordKind="policy"
      recordName={policy.name}
      sectionHref="/data"
      sectionLabel="Policies"
      subtitle={`${policy.author} · ${policy.framework}`}
    >
      <section className="mb-10">
        <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
          Overview
        </h2>
        <div className="border-blueprint-navy/10 bg-white rounded-lg border px-5 py-1">
          <ProfileField
            fieldName="name"
            label="Name"
            recordId={policy.slug}
            recordKind="policy"
            recordName={policy.name}
            value={policy.name}
          />
          <ProfileField
            fieldName="author"
            label="Author"
            recordId={policy.slug}
            recordKind="policy"
            recordName={policy.name}
            value={policy.author}
          />
          <ProfileField
            fieldName="framework"
            label="Framework"
            recordId={policy.slug}
            recordKind="policy"
            recordName={policy.name}
            value={policy.framework}
          />
          <ProfileField
            fieldName="license"
            label="License"
            recordId={policy.slug}
            recordKind="policy"
            recordName={policy.name}
            value={policy.license}
          />
          <ProfileField
            fieldName="skill_type"
            label="Skill type"
            recordId={policy.slug}
            recordKind="policy"
            recordName={policy.name}
            value={policy.skill_type}
          />
          <ProfileField
            fieldName="evidence_level"
            label="Evidence level"
            recordId={policy.slug}
            recordKind="policy"
            recordName={policy.name}
            value={policy.evidence_level}
          />
          <ProfileField
            fieldName="task_description"
            label="Task description"
            layout="stacked"
            recordId={policy.slug}
            recordKind="policy"
            recordName={policy.name}
            value={policy.task_description}
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
          Spaces
        </h2>
        <div className="border-blueprint-navy/10 bg-white rounded-lg border px-5 py-1">
          <ProfileField
            currentValueHint={`${policy.action_space.type} · ${String(policy.action_space.dimensions)}-dim @ ${String(policy.action_space.frequency_hz)}Hz`}
            fieldName="action_space"
            label="Action space"
            layout="stacked"
            recordId={policy.slug}
            recordKind="policy"
            recordName={policy.name}
            value={
              <span className="font-mono text-xs">
                {policy.action_space.type} · {policy.action_space.dimensions}-dim · {policy.action_space.frequency_hz}Hz
              </span>
            }
          />
          <ProfileField
            currentValueHint={`${policy.observation_space.type} · ${policy.observation_space.components.join(", ")}`}
            fieldName="observation_space"
            label="Observation space"
            layout="stacked"
            recordId={policy.slug}
            recordKind="policy"
            recordName={policy.name}
            value={
              <ul className="space-y-1">
                <li className="text-blueprint-navy/80 font-mono text-xs">type: {policy.observation_space.type}</li>
                {policy.observation_space.components.map((c) => (
                  <li className="text-blueprint-navy/80 font-mono text-xs" key={c}>
                    · {c}
                  </li>
                ))}
              </ul>
            }
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
          Links
        </h2>
        <div className="border-blueprint-navy/10 bg-white rounded-lg border px-5 py-1">
          <ProfileField
            currentValueHint={policy.hf_repo_id ?? undefined}
            fieldName="hf_repo_id"
            label="HuggingFace repo"
            recordId={policy.slug}
            recordKind="policy"
            recordName={policy.name}
            value={
              policy.hf_repo_id !== null && policy.hf_repo_id.length > 0 ? (
                <a
                  className="text-blueprint-navy hover:text-annotation-red font-mono text-sm underline decoration-dotted"
                  href={`https://huggingface.co/${policy.hf_repo_id}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {policy.hf_repo_id}
                </a>
              ) : null
            }
          />
          <ProfileField
            currentValueHint={policy.paper_arxiv_url ?? undefined}
            fieldName="paper_arxiv_url"
            label="Paper (arXiv)"
            recordId={policy.slug}
            recordKind="policy"
            recordName={policy.name}
            value={
              policy.paper_arxiv_url !== null && policy.paper_arxiv_url.length > 0 ? (
                <a
                  className="text-blueprint-navy hover:text-annotation-red text-sm underline decoration-dotted"
                  href={policy.paper_arxiv_url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {policy.paper_arxiv_url}
                </a>
              ) : null
            }
          />
        </div>
      </section>

      <section className="mb-10">
        <RelatedList
          emptyHint={`No robots list ${policy.name} as compatible yet. Know of one? Flag it above.`}
          items={robotsFromSlugs(policy.compatible_robot_slugs)}
          title="Compatible robots"
        />
      </section>

      <section className="mb-10">
        <RelatedList
          emptyHint={`No environments list ${policy.name} yet.`}
          items={environmentsFromSlugs(policy.compatible_env_slugs)}
          title="Compatible environments"
        />
      </section>

      <section>
        <RelatedList
          emptyHint={`No datasets reference ${policy.name} yet.`}
          items={datasetsByCompatiblePolicy(policy.slug)}
          title="Datasets that reference this policy"
        />
      </section>

      <AskAIButton recordName={policy.name} slug={policy.slug} table="policies" />
    </ProfileLayout>
  )
}
