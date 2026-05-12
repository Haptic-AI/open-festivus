import Link from "next/link"
import { Firehose } from "@/components/home/firehose"

const PROOF_PILLS = [
  "Action spaces",
  "Observation spaces",
  "Control frequency",
  "Sim-to-real transfer",
  "URDF/MJCF hosting",
  "Hardware compatibility",
  "Deploy readiness",
  "Dataset format conversion",
  "Reproducible benchmarks",
  "Build BOMs",
] as const

const GAPS = [
  "Playing with simulations without installing MuJoCo or Isaac Sim. No download, no conda env, no GPU driver dance.",
  "Seeing what a policy actually does across different robot embodiments. Does ACT work on SO-100 AND ALOHA 2? Side by side.",
  "Comparing five manipulation policies on the same task. Which one actually transfers to real hardware?",
  "Validated URDFs. Model cards don\u2019t specify action space or control frequency. 16,000+ robotics models on HF with no robotics-native metadata.",
  "Deploy readiness scores. Can I actually run this on my robot today, or is it research-only?",
  "Images, 3D viewers, simulation previews. Physical AI lives in visual media, not text READMEs.",
  "The 70% of a robot project that doesn\u2019t live in code: BOMs, wiring diagrams, calibration notes, deployment logs.",
] as const

export default function RoboticsFirstPage() {
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
          <p className="text-safety-yellow mb-4 font-mono text-4xl font-bold">02</p>
          <h1 className="text-drafting-cream mb-2 font-mono text-3xl font-bold uppercase md:text-4xl">
            The HuggingFace for Robotics Is HuggingFace
          </h1>
          <p className="text-drafting-cream/50 mb-8 font-mono text-base uppercase tracking-wider md:text-lg">
            Robotics-First
          </p>

          {/* Lead */}
          <p className="text-drafting-cream/80 mb-2 max-w-3xl text-lg italic leading-relaxed">
            Policies and datasets do well on HuggingFace. What&apos;s missing is everything around them.
          </p>
          <p className="mb-12">
            <a
              className="text-safety-yellow text-sm font-bold"
              href="https://hapticlabs.ai"
              rel="noopener noreferrer"
              target="_blank"
            >
              This is Festivus →
            </a>
          </p>

          {/* Our Thesis */}
          <div className="bg-drafting-cream/20 mb-8 h-px" />
          <h2 className="text-drafting-cream mb-6 font-mono text-xl font-bold uppercase tracking-wider">
            Our Thesis
          </h2>
          <p className="text-drafting-cream/80 mb-12 max-w-3xl text-base leading-relaxed">
            Many people talk about building &quot;the HuggingFace for robotics.&quot; We believe that
            already exists. HuggingFace is great at hosting models and datasets. We don&apos;t compete
            with that. Festivus is the layer that covers what HF, arXiv, and GitHub don&apos;t: the
            robotics-native connective tissue.
          </p>

          {/* What's Missing */}
          <div className="bg-drafting-cream/20 mb-8 h-px" />
          <h2 className="text-drafting-cream mb-4 font-mono text-xl font-bold uppercase tracking-wider">
            What&apos;s Missing
          </h2>
          <p className="text-drafting-cream/60 mb-6 text-sm">
            These are the gaps not covered by arXiv, GitHub, or HuggingFace:
          </p>
          <ol className="text-drafting-cream/80 mb-12 max-w-3xl list-none space-y-4 text-sm leading-relaxed">
            {GAPS.map((point, i) => (
              <li className="flex gap-3" key={i}>
                <span className="text-safety-yellow shrink-0 font-mono font-bold">
                  {i + 1}.
                </span>
                {point}
              </li>
            ))}
          </ol>

          {/* What We Build */}
          <div className="bg-drafting-cream/20 mb-8 h-px" />
          <h2 className="text-drafting-cream mb-6 font-mono text-xl font-bold uppercase tracking-wider">
            What We Build
          </h2>

          {/* Proof pills */}
          <div className="mb-10 flex flex-wrap gap-2">
            {PROOF_PILLS.map((pill) => (
              <span
                className="bg-drafting-cream/10 text-drafting-cream rounded px-3 py-1 text-xs"
                key={pill}
              >
                {pill}
              </span>
            ))}
          </div>

          {/* Live SO-100 card */}
          <div className="border-drafting-cream/10 mb-12 rounded-lg border bg-[#162033] p-5">
            <div className="flex items-start gap-4">
              <div className="bg-drafting-cream/10 text-drafting-cream flex h-12 w-12 shrink-0 items-center justify-center rounded-lg font-mono text-xl font-bold">
                S
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-drafting-cream text-sm font-bold">SO-100</h3>
                <div className="text-drafting-cream/60 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>$110</span>
                  <span>6-DoF</span>
                  <span>Single arm</span>
                  <span>lab_only</span>
                </div>
                <p className="text-drafting-cream/40 mt-2 text-xs">5 compatible policies</p>
              </div>
            </div>
          </div>

          {/* CTA — workbench launch is queued; route open data instead. */}
          <Link
            className="bg-safety-yellow text-blueprint-navy inline-block rounded-lg px-8 py-3 text-sm font-bold uppercase tracking-wider"
            href="/data"
          >
            Browse the Data →
          </Link>
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
