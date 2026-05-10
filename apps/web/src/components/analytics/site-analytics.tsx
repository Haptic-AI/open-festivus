import { AnalyticsClient } from "./analytics-client"

/**
 * Server-side analytics gate. All third-party analytics tags load through
 * this component so we have one place to add, audit, or remove them.
 *
 * Env vars (all optional, all read server-side, scoped on Vercel project):
 *   ANALYTICS_GA4_MEASUREMENT_ID      e.g. "G-XXXXXXXXXX"
 *   ANALYTICS_TELEMETRYDECK_APP_ID    UUID from TelemetryDeck dashboard
 *   ANALYTICS_TELEMETRYDECK_NAMESPACE bundle-style namespace, prefixed onto signal types
 *
 * Each tag self-skips when its env var is missing. The whole component skips
 * unless VERCEL_ENV === "production" so previews and local dev stay quiet.
 */
export function SiteAnalytics() {
  if (process.env.VERCEL_ENV !== "production") {
    return null
  }

  const ga4MeasurementId = process.env.ANALYTICS_GA4_MEASUREMENT_ID ?? null
  const telemetryDeckAppId = process.env.ANALYTICS_TELEMETRYDECK_APP_ID ?? null
  const telemetryDeckNamespace = process.env.ANALYTICS_TELEMETRYDECK_NAMESPACE ?? null

  return (
    <AnalyticsClient
      ga4MeasurementId={ga4MeasurementId}
      telemetryDeckAppId={telemetryDeckAppId}
      telemetryDeckNamespace={telemetryDeckNamespace}
    />
  )
}
