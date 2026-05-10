"use client"

import { useUser } from "@clerk/nextjs"
import TelemetryDeck from "@telemetrydeck/sdk"
import { Analytics as VercelAnalytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import Script from "next/script"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef } from "react"

interface IAnalyticsClientProps {
  ga4MeasurementId: string | null
  telemetryDeckAppId: string | null
  telemetryDeckNamespace: string | null
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

// GoogleAnalytics and TelemetryDeckTracker call useSearchParams(). Without a
// Suspense boundary Next 15 fails the static prerender pass with
// "useSearchParams() should be wrapped in a suspense boundary". Layout-level
// analytics affects every static page, so wrap each consumer here once.
export function AnalyticsClient({
  ga4MeasurementId,
  telemetryDeckAppId,
  telemetryDeckNamespace,
}: IAnalyticsClientProps) {
  return (
    <>
      {ga4MeasurementId !== null && (
        <Suspense fallback={null}>
          <GoogleAnalytics measurementId={ga4MeasurementId} />
        </Suspense>
      )}
      {telemetryDeckAppId !== null && (
        <Suspense fallback={null}>
          <TelemetryDeckTracker
            appId={telemetryDeckAppId}
            namespace={telemetryDeckNamespace}
          />
        </Suspense>
      )}
      <VercelAnalytics />
      <SpeedInsights />
    </>
  )
}

interface IGoogleAnalyticsProps {
  measurementId: string
}

function GoogleAnalytics({ measurementId }: IGoogleAnalyticsProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === "undefined" || window.gtag === undefined) {
      return
    }
    const query = searchParams.toString()
    const url = query.length > 0 ? `${pathname}?${query}` : pathname
    window.gtag("event", "page_view", {
      page_path: url,
      page_location: window.location.href,
    })
  }, [pathname, searchParams])

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}', { send_page_view: false });`}
      </Script>
    </>
  )
}

interface ITelemetryDeckTrackerProps {
  appId: string
  namespace: string | null
}

function TelemetryDeckTracker({ appId, namespace }: ITelemetryDeckTrackerProps) {
  const { isLoaded, user } = useUser()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sdkRef = useRef<TelemetryDeck | null>(null)

  useEffect(() => {
    if (!isLoaded) {
      return
    }
    const clientUser = user?.id ?? "anonymous"
    sdkRef.current = new TelemetryDeck({ appID: appId, clientUser })
  }, [appId, isLoaded, user?.id])

  useEffect(() => {
    const sdk = sdkRef.current
    if (sdk === null) {
      return
    }
    const query = searchParams.toString()
    const url = query.length > 0 ? `${pathname}?${query}` : pathname
    const signalType =
      namespace !== null && namespace.length > 0 ? `${namespace}.pageview` : "pageview"
    void sdk.signal(signalType, { route: url })
  }, [appId, namespace, pathname, searchParams])

  return null
}
