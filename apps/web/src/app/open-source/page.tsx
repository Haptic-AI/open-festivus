import Link from "next/link"
import { Firehose } from "@/components/home/firehose"

const WE_HOST_ITEMS = [
  "Workbench configurations",
  "Generated sim environments",
  "Community benchmark results",
  "Recipes (robot + policy + env combos)",
  "Deploy readiness assessments",
  "Build logs and community tips",
] as const

const WE_LINK_ITEMS = [
  { label: "Model weights", dest: "HuggingFace" },
  { label: "Datasets", dest: "HuggingFace" },
  { label: "Papers", dest: "arXiv" },
  { label: "Robot specs", dest: "Manufacturer sites" },
  { label: "Source code", dest: "GitHub repos" },
  { label: "STL/URDF files", dest: "Original repos" },
] as const

export default function OpenSourcePage() {
  return (
    <main>
      <section className="bg-blueprint-navy blueprint-grid px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-4xl">
          {/* Back link */}
          <Link
            className="text-drafting-cream/50 mb-12 inline-block text-sm transition-colors hover:text-drafting-cream"
            href="/"
          >
            ← Back to home
          </Link>

          {/* Header */}
          <p className="text-safety-yellow mb-4 font-mono text-4xl font-bold">01</p>
          <h1 className="text-drafting-cream mb-2 font-mono text-3xl font-bold uppercase md:text-4xl">
            Steal This Code
          </h1>
          <p className="text-drafting-cream/50 mb-8 font-mono text-base uppercase tracking-wider md:text-lg">
            Open Source-First
          </p>

          {/* Lead */}
          <p className="text-drafting-cream mb-12 max-w-3xl text-xl font-bold leading-relaxed">
            Clone it. Fork it. Copy it. Remix it. Throw it away and build a better one. We mean that.
          </p>

          {/* What We Believe */}
          <div className="bg-drafting-cream/20 mb-8 h-px" />
          <h2 className="text-drafting-cream mb-6 font-mono text-xl font-bold uppercase tracking-wider">
            What We Believe
          </h2>
          <p className="text-drafting-cream/80 mb-12 max-w-3xl text-base leading-relaxed">
            Physical AI is non-zero-sum. The ecosystem grows when knowledge flows freely. We reject
            the walled-garden model. Steal this code, steal this data, fork it, remix it. If you
            build something better, that is the point.
          </p>

          {/* How We Act on It */}
          <div className="bg-drafting-cream/20 mb-8 h-px" />
          <h2 className="text-drafting-cream mb-6 font-mono text-xl font-bold uppercase tracking-wider">
            How We Act on It
          </h2>

          <p className="text-drafting-cream/80 mb-8 max-w-3xl text-base leading-relaxed">
            We contribute, never extract. Every robot links to its manufacturer. Every policy to its
            HuggingFace checkpoint. Every paper to arXiv.
          </p>

          {/* We Host / We Link To */}
          <div className="mb-10 grid gap-8 md:grid-cols-2">
            <div>
              <p className="text-drafting-cream/60 mb-3 text-xs font-bold uppercase tracking-wider">
                We Host
              </p>
              <ul className="space-y-2">
                {WE_HOST_ITEMS.map((item) => (
                  <li className="text-drafting-cream flex items-center gap-2 text-sm" key={item}>
                    <span className="bg-drafting-cream h-1 w-1 shrink-0 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-drafting-cream/60 mb-3 text-xs font-bold uppercase tracking-wider">
                We Link To
              </p>
              <ul className="space-y-2">
                {WE_LINK_ITEMS.map((item) => (
                  <li className="text-drafting-cream text-sm" key={item.label}>
                    {item.label} <span className="text-drafting-cream/40">→</span> {item.dest}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-drafting-cream/80 mb-8 max-w-3xl text-base leading-relaxed">
            Provenance and credit: we work hard so contributors get attribution and data lineage
            stays clear. Our goal is to make it ridiculously easy for anyone to contribute to the
            Physical AI ecosystem, no matter what part of the stack they work on or what skills
            they have.
          </p>

          {/* Bold statement */}
          <p className="text-drafting-cream mb-8 max-w-3xl text-base font-bold leading-relaxed">
            Festivus only wins if HuggingFace, GitHub, and arXiv are stronger for it.
          </p>

          {/* Pull quotes */}
          <p className="text-safety-yellow mb-4 max-w-3xl text-xl font-bold leading-relaxed">
            The connective tissue is the product. The ecosystem is the platform.
          </p>
          <p className="text-drafting-cream/60 mb-12 max-w-3xl text-sm leading-relaxed">
            MIT license. No CLA. Fork-friendly.
          </p>

          {/* CTA */}
          <div className="flex flex-wrap items-center gap-4">
            <a
              className="bg-safety-yellow text-blueprint-navy inline-block rounded-lg px-8 py-3 text-sm font-bold uppercase tracking-wider"
              href="https://github.com/haptic-ai/festivus"
              rel="noopener noreferrer"
              target="_blank"
            >
              View on GitHub →
            </a>
            <Link
              className="text-safety-yellow text-sm font-bold uppercase tracking-wider"
              href="/contribute"
            >
              See how you can participate →
            </Link>
          </div>
          <p className="text-drafting-cream/40 mt-3 text-xs">
            MIT Licensed
          </p>
        </div>
      </section>

      <Firehose />

      {/* Footer */}
      <footer className="bg-blueprint-navy px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="text-drafting-cream/40 text-xs font-bold uppercase tracking-wider">
            Festivus
          </p>
          <p className="text-drafting-cream/30 text-xs">
            Open Source Physical AI for the Rest of Us by{" "}
            <a
              className="text-drafting-cream/50 underline decoration-dotted transition-colors hover:text-drafting-cream"
              href="https://hapticlabs.ai"
              rel="noopener noreferrer"
              target="_blank"
            >
              Haptic
            </a>
          </p>
        </div>
      </footer>
    </main>
  )
}
