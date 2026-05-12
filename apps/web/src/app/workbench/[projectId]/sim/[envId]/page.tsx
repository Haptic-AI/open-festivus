import Link from "next/link"

const VIDEO_URL = "https://www.youtube.com/embed/P83tKA1iz2Y?autoplay=1&loop=1&mute=1&controls=0&showinfo=0"

interface ISimPageProps {
  params: Promise<{ projectId: string; envId: string }>
}

export default async function SimViewerPage({ params }: ISimPageProps) {
  const { projectId, envId } = await params

  return (
    <div className="relative flex h-screen w-screen flex-col" style={{ backgroundColor: "#111" }}>
      {/* Top bar */}
      <div className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between px-6 py-4">
        <Link
          className="text-xs font-bold uppercase tracking-[0.2em] transition-opacity hover:opacity-60"
          href={`/workbench/${projectId}`}
          style={{ color: "#eee" }}
        >
          Festivus
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: "#eee" }}>{envId}</span>
          <span className="rounded px-2 py-0.5 text-[14px]" style={{ color: "#888", backgroundColor: "rgba(255,255,255,0.08)" }}>
            MuJoCo
          </span>
        </div>
      </div>

      {/* Video viewport */}
      <div className="flex flex-1 items-center justify-center">
        <iframe
          allowFullScreen
          allow="autoplay; encrypted-media"
          className="h-full w-full"
          src={VIDEO_URL}
          style={{ border: "none" }}
          title="Environment simulation"
        />
      </div>

      {/* Bottom bar */}
      <div className="absolute right-0 bottom-0 left-0 z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          {["Indoor", "Flat surface", "Standard lighting"].map((tag) => (
            <span
              className="rounded px-2 py-1 text-[14px]"
              key={tag}
              style={{ color: "#888", backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="group relative">
          <button
            disabled
            className="rounded px-4 py-2 text-xs font-bold"
            style={{ backgroundColor: "rgba(255,211,38,0.15)", color: "#FFD326", opacity: 0.5, cursor: "not-allowed" }}
            type="button"
          >
            Run evaluation &rarr;
          </button>
          <div className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded px-3 py-1.5 text-[14px] opacity-0 transition-opacity group-hover:opacity-100" style={{ backgroundColor: "#222", color: "#888" }}>
            Coming soon
          </div>
        </div>
      </div>
    </div>
  )
}
