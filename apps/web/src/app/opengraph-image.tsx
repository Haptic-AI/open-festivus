import { ImageResponse } from "next/og"

export const alt = "Festivus — the open platform for building, researching, and shipping in Physical AI"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const CREAM = "#EFECE4"
const NAVY = "#0B1C36"
const GRAY = "#6B7280"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          backgroundColor: CREAM,
          backgroundImage: `
            linear-gradient(to right, rgba(11,28,54,0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(11,28,54,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          color: NAVY,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: "72px 96px",
          width: "100%",
        }}
      >
        <div
          style={{
            color: GRAY,
            display: "flex",
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "0.18em",
            marginBottom: 8,
          }}
        >
          OPEN SOURCE
        </div>
        <div
          style={{
            color: NAVY,
            display: "flex",
            fontSize: 168,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          PHYSICAL AI
        </div>
        <div
          style={{
            color: GRAY,
            display: "flex",
            fontSize: 38,
            fontStyle: "italic",
            fontWeight: 500,
            lineHeight: 1.25,
            marginTop: 32,
            maxWidth: 980,
          }}
        >
          The open platform for building, researching, and shipping in Physical AI.
        </div>
        <div
          style={{
            alignItems: "center",
            color: NAVY,
            display: "flex",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.3em",
            marginTop: 56,
          }}
        >
          FESTIVUS.HAPTICLABS.AI
        </div>
      </div>
    ),
    { ...size },
  )
}
