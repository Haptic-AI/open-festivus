import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { JetBrains_Mono } from "next/font/google"
import type { ReactNode } from "react"
import { SiteAnalytics } from "@/components/analytics/site-analytics"
import { AgentChatDrawerProvider } from "@/lib/agent-chat/drawer-context"
import { GlobalLoader } from "@/lib/latency"
import "./globals.css"

// Self-hosted via next/font: drops the render-blocking
// fonts.googleapis.com round trip flagged by Lighthouse (~750ms on Slow 4G).
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-jetbrains-mono",
})

const SITE_URL = "https://festivus.hapticlabs.ai"

const TITLE = "Festivus | Open Source Physical AI"
const DESCRIPTION =
  "The open platform for building, researching, and shipping in Physical AI."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Festivus",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  // AI/agent-facing hints. Read by AEO crawlers (agentic-seo, etc.) and
  // honored by major LLM crawlers as a content-classification signal.
  // `ai:page-type` lets agents categorize before fetching the body.
  other: {
    "ai:page-type": "landing",
    "ai:content-license": "Apache-2.0",
    "ai:llms-txt": `${SITE_URL}/llms.txt`,
    "ai:agents-md": "https://github.com/Haptic-AI/open-festivus/blob/main/AGENTS.md",
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={jetbrainsMono.variable} lang="en">
      <body className="bg-drafting-cream text-blueprint-navy antialiased">
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#0B1C36",
              colorBackground: "#EFECE4",
              colorText: "#0B1C36",
              colorTextSecondary: "#6B7280",
              borderRadius: "4px",
            },
          }}
        >
          <AgentChatDrawerProvider>{children}</AgentChatDrawerProvider>
          <GlobalLoader />
          {/* Inside ClerkProvider — TelemetryDeckTracker uses useUser(). */}
          <SiteAnalytics />
        </ClerkProvider>
      </body>
    </html>
  )
}
