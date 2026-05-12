import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site-header"
import { getRequestUser } from "@/lib/auth"

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode
}): Promise<React.JSX.Element> {
  const user = await getRequestUser()
  if (!user) {
    redirect("/sign-in?redirect_url=/settings/api-keys")
  }
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">{children}</main>
    </div>
  )
}
