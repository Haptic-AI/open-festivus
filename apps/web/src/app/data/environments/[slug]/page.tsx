import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { IEnvironment } from "@festivus/types"
import { AskAIButton } from "@/components/agent-chat/AskAIButton"
import { ProfileLayout } from "@/components/data-profile/profile-layout"
import { ProfileField } from "@/components/data-profile/profile-field"
import { FestivusClient } from "@/lib/api/festivus-client"

export const dynamicParams = true

interface IPageProps {
  params: Promise<{ slug: string }>
}

async function findEnvironment(slug: string): Promise<IEnvironment | null> {
  const envs = await new FestivusClient().searchEnvironments({ limit: 500 })
  return envs?.find((e) => e.slug === slug || e.id === slug) ?? null
}

export async function generateMetadata({ params }: IPageProps): Promise<Metadata> {
  const { slug } = await params
  const env = await findEnvironment(slug)
  if (env === null) return { title: "Not found | Festivus" }
  return {
    title: `${env.name} · environment | Festivus`,
    description: env.description.slice(0, 160),
  }
}

export default async function EnvironmentProfilePage({ params }: IPageProps) {
  const { slug } = await params
  const env = await findEnvironment(slug)
  if (env === null) notFound()

  return (
    <ProfileLayout
      recordId={env.slug}
      recordKind="environment"
      recordName={env.name}
      sectionHref="/data"
      sectionLabel="Environments"
      subtitle={`${env.simulator} · ${env.scene}`}
    >
      <section className="mb-10">
        <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
          Overview
        </h2>
        <div className="border-blueprint-navy/10 bg-white rounded-lg border px-5 py-1">
          <ProfileField
            fieldName="name"
            label="Name"
            recordId={env.slug}
            recordKind="environment"
            recordName={env.name}
            value={env.name}
          />
          <ProfileField
            fieldName="simulator"
            label="Simulator"
            recordId={env.slug}
            recordKind="environment"
            recordName={env.name}
            value={env.simulator}
          />
          <ProfileField
            fieldName="scene"
            label="Scene"
            recordId={env.slug}
            recordKind="environment"
            recordName={env.name}
            value={env.scene}
          />
          <ProfileField
            fieldName="description"
            label="Description"
            layout="stacked"
            recordId={env.slug}
            recordKind="environment"
            recordName={env.name}
            value={env.description}
          />
        </div>
      </section>

      <AskAIButton recordName={env.name} slug={env.slug} table="environments" />
    </ProfileLayout>
  )
}
