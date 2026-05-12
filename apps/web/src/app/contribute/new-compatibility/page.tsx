import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { getRequestUser } from "@/lib/auth"
import { NewCompatibilityForm } from "./new-compatibility-form"

export const metadata: Metadata = {
  title: "Add a compatibility edge | Festivus",
  description: "Submit a new Robot × Policy compatibility entry to the Festivus catalog.",
}

export default async function NewCompatibilityPage() {
  const user = await getRequestUser()
  if (!user) redirect("/sign-in?redirect_url=/contribute/new-compatibility")

  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-3xl px-6 py-10 sm:px-10">
        <Link
          className="text-blueprint-navy/60 hover:text-blueprint-navy mb-6 inline-block font-mono text-xs font-bold uppercase tracking-wider"
          href="/contribute"
        >
          ← Back to Contribute
        </Link>

        <header className="mb-8">
          <h1 className="text-blueprint-navy text-2xl font-bold leading-tight md:text-3xl">
            Add a compatibility edge
          </h1>
          <p className="text-blueprint-navy/70 mt-3 max-w-2xl text-sm leading-relaxed">
            Every entry on Festivus is a <strong>Robot × Policy</strong> pair: does
            this policy work on this robot, and how well? Pick a robot, pick a
            policy, then tell us what you know. Anything from a measured success
            rate to a flagged untested gap is useful.
          </p>
        </header>

        <NewCompatibilityForm />
      </div>
    </main>
  )
}
