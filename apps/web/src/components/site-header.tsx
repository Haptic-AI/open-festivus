"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { SignInButton, useUser } from "@clerk/nextjs"
import { SearchBar } from "@/components/search-bar"
import { UserButtonWithApiKeys } from "@/components/user-button-with-api-keys"
import { isModerator } from "@/lib/moderator"

interface ISiteHeaderProps {
  variant?: "light" | "dark"
}

interface INavItem {
  href: string
  label: string
  matchPrefix?: string
}

const NAV_ITEMS: INavItem[] = [
  { href: "/", label: "Home" },
  { href: "/data", label: "Data", matchPrefix: "/data" },
  // Workbench hidden from primary nav until the formal launch — route still
  // works for direct links and the agent flow, just not promoted.
  { href: "/contribute", label: "Contribute", matchPrefix: "/contribute" },
]

function isActive(pathname: string, item: INavItem): boolean {
  if (item.matchPrefix !== undefined) {
    if (item.matchPrefix === "/") return pathname === "/"
    return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`)
  }
  return pathname === item.href
}

export function SiteHeader({ variant = "light" }: ISiteHeaderProps) {
  const { isSignedIn, isLoaded, user } = useUser()
  const pathname = usePathname() ?? "/"

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? null
  const navItems: INavItem[] = isModerator(userEmail)
    ? [...NAV_ITEMS, { href: "/moderate", label: "Moderate", matchPrefix: "/moderate" }]
    : NAV_ITEMS

  const textColor = variant === "dark" ? "text-drafting-cream" : "text-blueprint-navy"
  const textMuted =
    variant === "dark" ? "text-drafting-cream/60" : "text-blueprint-navy/60"
  const textMutedHover =
    variant === "dark" ? "hover:text-drafting-cream" : "hover:text-blueprint-navy"
  const borderColor =
    variant === "dark" ? "border-drafting-cream/10" : "border-blueprint-navy/10"
  const activeBg =
    variant === "dark" ? "bg-drafting-cream text-blueprint-navy" : "bg-blueprint-navy text-safety-yellow"

  return (
    <header
      className={`${borderColor} relative z-50 flex items-center gap-6 border-b px-5 py-3`}
    >
      <div className="flex shrink-0 items-center gap-6">
        <Link
          className={`${textColor} text-base font-bold uppercase tracking-[0.18em] transition-opacity hover:opacity-60`}
          href="/"
        >
          Festivus
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {navItems.map((item) => {
            const active = isActive(pathname, item)
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? `${activeBg} rounded px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.15em]`
                    : `${textMuted} ${textMutedHover} rounded px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.15em] transition-colors`
                }
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Flex child, not absolute. The previous overlay sat above the nav and
          overlapped Contribute/Moderate at narrower widths. min-w-0 lets it
          shrink below intrinsic content size when the viewport tightens. */}
      <div className="hidden min-w-0 flex-1 justify-center md:flex">
        <div className="w-full max-w-sm">
          <SearchBar variant={variant} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 md:ml-0 ml-auto">
        {isLoaded ? (
          isSignedIn ? (
            <UserButtonWithApiKeys />
          ) : (
            <SignInButton mode="redirect">
              <button
                className={`${textMuted} ${textMutedHover} cursor-pointer font-mono text-xs font-bold uppercase tracking-[0.15em] transition-colors`}
                type="button"
              >
                Sign in
              </button>
            </SignInButton>
          )
        ) : null}
      </div>
    </header>
  )
}
