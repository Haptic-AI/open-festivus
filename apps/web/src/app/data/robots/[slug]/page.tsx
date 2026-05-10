import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { IRobot } from "@festivus/types"
import { AskAIButton } from "@/components/agent-chat/AskAIButton"
import { ProfileLayout } from "@/components/data-profile/profile-layout"
import { ProfileField } from "@/components/data-profile/profile-field"
import { RelatedList } from "@/components/data-profile/related-list"
import { environmentsFromSlugs, policiesFromSlugs } from "@/lib/data/lookups"
import { FestivusClient } from "@/lib/api/festivus-client"

export const dynamicParams = true

async function findRobot(slug: string): Promise<IRobot | null> {
  return new FestivusClient().getRobot(slug)
}

interface IPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: IPageProps): Promise<Metadata> {
  const { slug } = await params
  const robot = await findRobot(slug)
  if (robot === null) return { title: "Not found | Festivus" }
  return {
    title: `${robot.name} · robot | Festivus`,
    description: robot.description.slice(0, 160),
  }
}

export default async function RobotProfilePage({ params }: IPageProps) {
  const { slug } = await params
  const robot = await findRobot(slug)
  if (robot === null) notFound()

  const dofValue = robot.dof !== null ? `${String(robot.dof)}` : null
  const weightValue = robot.weight_kg !== null ? `${String(robot.weight_kg)} kg` : null
  const priceValue = robot.price_usd !== null ? `$${robot.price_usd.toLocaleString()}` : null

  return (
    <ProfileLayout
      imageUrl={robot.image_url}
      recordId={robot.slug}
      recordKind="robot"
      recordName={robot.name}
      sectionHref="/data"
      sectionLabel="Robots"
      subtitle={`${robot.manufacturer} · ${robot.category}`}
    >
      <section className="mb-10">
        <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
          Specs
        </h2>
        <div className="border-blueprint-navy/10 bg-white rounded-lg border px-5 py-1">
          <ProfileField
            fieldName="name"
            label="Name"
            recordId={robot.slug}
            recordKind="robot"
            recordName={robot.name}
            value={robot.name}
          />
          <ProfileField
            fieldName="manufacturer"
            label="Manufacturer"
            recordId={robot.slug}
            recordKind="robot"
            recordName={robot.name}
            value={robot.manufacturer}
          />
          <ProfileField
            currentValueHint={robot.type}
            fieldName="type"
            label="Type"
            recordId={robot.slug}
            recordKind="robot"
            recordName={robot.name}
            value={robot.type}
          />
          <ProfileField
            currentValueHint={robot.dof !== null ? String(robot.dof) : undefined}
            fieldName="dof"
            label="Degrees of Freedom"
            recordId={robot.slug}
            recordKind="robot"
            recordName={robot.name}
            value={dofValue}
          />
          <ProfileField
            currentValueHint={robot.weight_kg !== null ? String(robot.weight_kg) : undefined}
            fieldName="weight_kg"
            label="Weight"
            recordId={robot.slug}
            recordKind="robot"
            recordName={robot.name}
            value={weightValue}
          />
          <ProfileField
            currentValueHint={robot.price_usd !== null ? String(robot.price_usd) : undefined}
            fieldName="price_usd"
            label="Price"
            recordId={robot.slug}
            recordKind="robot"
            recordName={robot.name}
            value={priceValue}
          />
          <ProfileField
            fieldName="form_factor"
            label="Form factor"
            recordId={robot.slug}
            recordKind="robot"
            recordName={robot.name}
            value={robot.form_factor}
          />
          <ProfileField
            fieldName="deploy_readiness"
            label="Deploy readiness"
            recordId={robot.slug}
            recordKind="robot"
            recordName={robot.name}
            value={robot.deploy_readiness}
          />
          <ProfileField
            currentValueHint={robot.actuators ?? undefined}
            fieldName="actuators"
            label="Actuators"
            layout="stacked"
            recordId={robot.slug}
            recordKind="robot"
            recordName={robot.name}
            value={robot.actuators}
          />
          <ProfileField
            currentValueHint={robot.sensors.join(", ")}
            fieldName="sensors"
            label="Sensors"
            layout="stacked"
            recordId={robot.slug}
            recordKind="robot"
            recordName={robot.name}
            value={
              robot.sensors.length > 0 ? (
                <ul className="space-y-1">
                  {robot.sensors.map((s) => (
                    <li className="text-blueprint-navy/80 text-sm" key={s}>
                      · {s}
                    </li>
                  ))}
                </ul>
              ) : null
            }
          />
          <ProfileField
            fieldName="description"
            label="Description"
            layout="stacked"
            recordId={robot.slug}
            recordKind="robot"
            recordName={robot.name}
            value={robot.description}
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
          Links
        </h2>
        <div className="border-blueprint-navy/10 bg-white rounded-lg border px-5 py-1">
          <ProfileField
            currentValueHint={robot.product_page_url}
            fieldName="product_page_url"
            label="Product page"
            recordId={robot.slug}
            recordKind="robot"
            recordName={robot.name}
            value={
              robot.product_page_url.length > 0 ? (
                <a
                  className="text-blueprint-navy hover:text-annotation-red underline decoration-dotted"
                  href={robot.product_page_url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {robot.product_page_url}
                </a>
              ) : null
            }
          />
          <ProfileField
            currentValueHint={robot.image_url ?? undefined}
            fieldName="image_url"
            label="Image URL"
            recordId={robot.slug}
            recordKind="robot"
            recordName={robot.name}
            value={
              robot.image_url !== null && robot.image_url.length > 0 ? (
                <a
                  className="text-blueprint-navy hover:text-annotation-red truncate underline decoration-dotted"
                  href={robot.image_url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {robot.image_url}
                </a>
              ) : null
            }
          />
        </div>
      </section>

      <section className="mb-10">
        <RelatedList
          emptyHint={`No policies list ${robot.name} as a compatible robot yet. Know of one? Flag it above.`}
          items={policiesFromSlugs(robot.compatible_policy_slugs)}
          title="Compatible policies"
        />
      </section>

      <section>
        <RelatedList
          emptyHint={`No environments list ${robot.name} yet.`}
          items={environmentsFromSlugs(robot.compatible_env_slugs)}
          title="Compatible environments"
        />
      </section>

      <AskAIButton recordName={robot.name} slug={robot.slug} table="robots" />
    </ProfileLayout>
  )
}
