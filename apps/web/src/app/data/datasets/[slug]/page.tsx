import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { IDataset } from "@festivus/types"
import { AskAIButton } from "@/components/agent-chat/AskAIButton"
import { ProfileLayout } from "@/components/data-profile/profile-layout"
import { ProfileField } from "@/components/data-profile/profile-field"
import { FestivusClient } from "@/lib/api/festivus-client"

export const dynamicParams = true

interface IPageProps {
  params: Promise<{ slug: string }>
}

async function findDataset(slug: string): Promise<IDataset | null> {
  return new FestivusClient().getDataset(slug)
}

export async function generateMetadata({ params }: IPageProps): Promise<Metadata> {
  const { slug } = await params
  const dataset = await findDataset(slug)
  if (dataset === null) return { title: "Not found | Festivus" }
  return {
    title: `${dataset.name} · dataset | Festivus`,
    description: dataset.description.slice(0, 160),
  }
}

export default async function DatasetProfilePage({ params }: IPageProps) {
  const { slug } = await params
  const dataset = await findDataset(slug)
  if (dataset === null) notFound()

  const episodesValue = dataset.episodes !== null ? dataset.episodes.toLocaleString() : null

  return (
    <ProfileLayout
      recordId={dataset.slug}
      recordKind="dataset"
      recordName={dataset.name}
      sectionHref="/data"
      sectionLabel="Datasets"
      subtitle={dataset.source}
    >
      <section className="mb-10">
        <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
          Overview
        </h2>
        <div className="border-blueprint-navy/10 bg-white rounded-lg border px-5 py-1">
          <ProfileField
            fieldName="name"
            label="Name"
            recordId={dataset.slug}
            recordKind="dataset"
            recordName={dataset.name}
            value={dataset.name}
          />
          <ProfileField
            fieldName="source"
            label="Source"
            recordId={dataset.slug}
            recordKind="dataset"
            recordName={dataset.name}
            value={dataset.source}
          />
          <ProfileField
            currentValueHint={dataset.episodes !== null ? String(dataset.episodes) : undefined}
            fieldName="episodes"
            label="Episodes"
            recordId={dataset.slug}
            recordKind="dataset"
            recordName={dataset.name}
            value={episodesValue}
          />
          <ProfileField
            currentValueHint={String(dataset.robots)}
            fieldName="robots"
            label="Robot count"
            recordId={dataset.slug}
            recordKind="dataset"
            recordName={dataset.name}
            value={dataset.robots}
          />
          <ProfileField
            fieldName="format"
            label="Format"
            recordId={dataset.slug}
            recordKind="dataset"
            recordName={dataset.name}
            value={dataset.format}
          />
          <ProfileField
            fieldName="description"
            label="Description"
            layout="stacked"
            recordId={dataset.slug}
            recordKind="dataset"
            recordName={dataset.name}
            value={dataset.description}
          />
          <ProfileField
            currentValueHint={dataset.robot_names.join(", ")}
            fieldName="robot_names"
            label="Robots used"
            layout="stacked"
            recordId={dataset.slug}
            recordKind="dataset"
            recordName={dataset.name}
            value={
              dataset.robot_names.length > 0 ? (
                <ul className="space-y-1">
                  {dataset.robot_names.map((r) => (
                    <li className="text-blueprint-navy/80 text-sm" key={r}>
                      · {r}
                    </li>
                  ))}
                </ul>
              ) : null
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
            currentValueHint={dataset.hf_dataset_id ?? undefined}
            fieldName="hf_dataset_id"
            label="HuggingFace dataset"
            recordId={dataset.slug}
            recordKind="dataset"
            recordName={dataset.name}
            value={
              dataset.hf_dataset_id !== null && dataset.hf_dataset_id.length > 0 ? (
                <a
                  className="text-blueprint-navy hover:text-annotation-red font-mono text-sm underline decoration-dotted"
                  href={`https://huggingface.co/datasets/${dataset.hf_dataset_id}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {dataset.hf_dataset_id}
                </a>
              ) : null
            }
          />
        </div>
      </section>

      <AskAIButton recordName={dataset.name} slug={dataset.slug} table="datasets" />
    </ProfileLayout>
  )
}
