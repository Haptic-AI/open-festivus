import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { Tooltip } from "@/components/ui/tooltip"

export const metadata: Metadata = {
  title: "Open Source Robot Policies, Datasets, and Benchmarks | Festivus",
  description:
    "Festivus is the open catalog of robot policies, datasets, environments, and benchmarks for physical AI. Browse, compare, and contribute.",
  alternates: { canonical: "/" },
  keywords: [
    "open source robot policies",
    "robotics datasets catalog",
    "lerobot policies",
    "physical AI benchmarks",
    "robot policy comparison",
    "huggingface robotics models",
    "robot deployment notes",
  ],
  openGraph: {
    title: "Open Source Robot Policies, Datasets, and Benchmarks | Festivus",
    description:
      "Browse the open catalog of robot policies, datasets, environments, and benchmarks for physical AI.",
    url: "/",
    siteName: "Festivus",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Source Robot Policies, Datasets, and Benchmarks | Festivus",
    description:
      "Browse the open catalog of robot policies, datasets, environments, and benchmarks for physical AI.",
  },
}

const catalogDimensions = [
  {
    href: "/data/robots",
    label: "Robots",
    blurb: "Hardware fingerprints. Manipulators, humanoids, quadrupeds, mobile bases.",
  },
  {
    href: "/data/policies",
    label: "Policies",
    blurb: "Open source robot policies. ACT, diffusion, RL, vision-language-action.",
  },
  {
    href: "/data/datasets",
    label: "Datasets",
    blurb: "Robotics datasets in LeRobot and HuggingFace formats. Provenance attached.",
  },
  {
    href: "/data/environments",
    label: "Environments",
    blurb: "Sim and real environments. MuJoCo, Isaac, real-world rigs.",
  },
  {
    href: "/data/tasks",
    label: "Tasks",
    blurb: "Pick-and-place, folding, locomotion, navigation. The vocabulary of physical AI.",
  },
  {
    href: "/data/papers",
    label: "Papers",
    blurb: "arXiv-linked physical AI papers tied to the policies that ship from them.",
  },
  {
    href: "/data/deploys",
    label: "Deploy notes",
    blurb: "What it took to get a policy off the bench and onto a real robot.",
  },
]

const audiences = [
  {
    who: "Robotics engineers",
    body: "Find a policy that runs on your hardware. Skip the LeRobot model hunt.",
  },
  {
    who: "AI researchers",
    body: "Compare benchmarks across policies. See what beats what, on which task.",
  },
  {
    who: "Lab leads",
    body: "Stand up a reproducible stack: dataset → policy → environment → deploy.",
  },
  {
    who: "Open source contributors",
    body: "Fix gaps in the catalog. Add a robot, a policy, a deploy note. Get attribution.",
  },
]

const compareSteps = [
  {
    n: "01",
    title: "Pick a task",
    body: "Folding laundry, transferring a cube, walking a quadruped. Start from the goal.",
  },
  {
    n: "02",
    title: "See compatible policies",
    body: "Filtered by hardware. Every policy lists the robots it's been validated on.",
  },
  {
    n: "03",
    title: "Inspect the dataset",
    body: "Provenance, episode count, sensor coverage, license. No CSV soup.",
  },
  {
    n: "04",
    title: "Read the deploy notes",
    body: "What broke. What worked. What the next team should try first.",
  },
  {
    n: "05",
    title: "Run it",
    body: "LeRobot weights, HuggingFace links, evaluation environments. One click.",
  },
]

export default function FestivusHomeV2Page() {
  return (
    <main>
      <SiteHeader />

      {/* HERO */}
      <section className="bg-drafting-cream relative min-h-[70vh] bg-[linear-gradient(rgba(11,28,54,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(11,28,54,0.03)_1px,transparent_1px)] bg-[size:40px_40px]">
        <div className="relative mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center px-6 py-20 text-center sm:px-10">
          <p className="text-blueprint-navy/60 mb-6 font-mono text-xs font-bold uppercase tracking-[0.3em]">
            Festivus
          </p>
          <h1 className="text-blueprint-navy font-mono text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Open source robot policies,
            <br />
            <span className="text-blueprint-navy/70">datasets, and benchmarks.</span>
            <br />
            <span className="text-blueprint-navy/55 text-3xl italic font-medium sm:text-4xl md:text-5xl">
              &ldquo;for the Rest of Us&rdquo;
            </span>
          </h1>
          <p className="text-blueprint-navy/70 mx-auto mt-8 max-w-2xl text-lg leading-relaxed">
            Festivus is the open catalog of robot policies, datasets, environments,
            and benchmarks for{" "}
            <Tooltip label="physical AI">
              AI that perceives and acts on the physical world. Robots, drones,
              autonomous systems. Distinct from LLMs because the body, sensors,
              and contact dynamics matter.
            </Tooltip>
            . Browse what works, compare across hardware, and contribute what you have.
          </p>
          <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              className="bg-safety-yellow text-blueprint-navy rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-wider"
              href="/data"
            >
              Browse the catalog →
            </Link>
            <Link
              className="text-blueprint-navy rounded-lg border-2 border-blueprint-navy px-6 py-3 text-sm font-bold uppercase tracking-wider"
              href="/contribute"
            >
              Contribute →
            </Link>
          </div>
        </div>
      </section>

      {/* THE 7 CATALOG DIMENSIONS — keyword-rich, internally linked */}
      <section className="bg-blueprint-navy px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-safety-yellow mb-4 font-mono text-xs font-bold uppercase tracking-[0.3em]">
            The catalog
          </p>
          <h2 className="text-drafting-cream mb-12 font-mono text-3xl font-bold uppercase leading-tight md:text-4xl">
            Seven dimensions. One catalog.
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalogDimensions.map((d, i) => (
              <Link
                className="border-drafting-cream/15 hover:border-safety-yellow group block border p-6 transition-colors"
                href={d.href}
                key={d.href}
              >
                <p className="text-safety-yellow mb-3 font-mono text-xs font-bold uppercase tracking-[0.2em]">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="text-drafting-cream group-hover:text-safety-yellow mb-2 font-mono text-xl font-bold uppercase tracking-wider transition-colors">
                  {d.label}
                </h3>
                <p className="text-drafting-cream/70 text-sm leading-relaxed">
                  {d.blurb}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="bg-drafting-cream px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-4xl">
          <p className="text-blueprint-navy/60 mb-4 font-mono text-xs font-bold uppercase tracking-[0.3em]">
            Why a catalog
          </p>
          <h2 className="text-blueprint-navy mb-8 font-mono text-3xl font-bold uppercase leading-tight md:text-4xl">
            Physical AI is scattered.
          </h2>
          <div className="text-blueprint-navy/80 grid gap-4 text-base leading-relaxed md:grid-cols-2 md:text-lg">
            <p>Policies live on HuggingFace, GitHub, and lab websites that go offline.</p>
            <p>Datasets ship in five different schemas. Half lack hardware metadata.</p>
            <p>Benchmarks compare apples to oranges. Different rigs, different metrics.</p>
            <p>Nobody knows which policy ran on which robot, on which task, with which result.</p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — comparison flow */}
      <section className="bg-drafting-cream border-blueprint-navy/10 border-t px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-blueprint-navy/60 mb-4 font-mono text-xs font-bold uppercase tracking-[0.3em]">
            How to use it
          </p>
          <h2 className="text-blueprint-navy mb-12 font-mono text-3xl font-bold uppercase leading-tight md:text-4xl">
            From task to running policy.
          </h2>
          <ol className="space-y-6">
            {compareSteps.map((step) => (
              <li
                className="border-blueprint-navy/15 flex gap-6 border-l-2 pl-6"
                key={step.n}
              >
                <span className="text-blueprint-navy/40 font-mono text-2xl font-bold">
                  {step.n}
                </span>
                <div>
                  <h3 className="text-blueprint-navy mb-1 font-mono text-lg font-bold uppercase tracking-wider">
                    {step.title}
                  </h3>
                  <p className="text-blueprint-navy/75 text-base leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* AUDIENCES */}
      <section className="bg-blueprint-navy px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-safety-yellow mb-4 font-mono text-xs font-bold uppercase tracking-[0.3em]">
            Who uses Festivus
          </p>
          <h2 className="text-drafting-cream mb-12 font-mono text-3xl font-bold uppercase leading-tight md:text-4xl">
            Built for the people shipping physical AI.
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {audiences.map((a) => (
              <div className="border-drafting-cream/15 border p-6" key={a.who}>
                <h3 className="text-safety-yellow mb-3 font-mono text-base font-bold uppercase tracking-wider">
                  {a.who}
                </h3>
                <p className="text-drafting-cream/80 text-base leading-relaxed">
                  {a.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OPEN SOURCE PROMISE */}
      <section className="bg-drafting-cream px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-blueprint-navy/60 mb-4 font-mono text-xs font-bold uppercase tracking-[0.3em]">
            Open by default
          </p>
          <h2 className="text-blueprint-navy mb-8 font-mono text-3xl font-bold uppercase leading-tight md:text-4xl">
            Papers stay on arXiv. Code stays on GitHub. Models stay on HuggingFace.
          </h2>
          <div className="text-blueprint-navy/80 space-y-4 text-base leading-relaxed md:text-lg">
            <p>
              Festivus links the catalog. It doesn&apos;t lock it up. Every policy,
              every dataset, every paper points back to the source. Credit and
              provenance stay clear.
            </p>
            <p>
              Fork it. Clone it. Remix it. Then push your contribution back so the
              next team finds it.
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-blueprint-navy px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-drafting-cream mb-6 font-mono text-3xl font-bold uppercase leading-tight md:text-4xl">
            Open source robot policies.
            <br />
            <span className="text-safety-yellow">All in one catalog.</span>
          </h2>
          <p className="text-drafting-cream/75 mx-auto mb-10 max-w-xl text-lg leading-relaxed">
            Browse the policies, datasets, and benchmarks the physical AI community
            actually ships. Then contribute what you have.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              className="bg-safety-yellow text-blueprint-navy rounded-lg px-8 py-4 text-sm font-bold uppercase tracking-wider"
              href="/data"
            >
              Browse the catalog →
            </Link>
            <Link
              className="text-drafting-cream rounded-lg border-2 border-drafting-cream/40 px-8 py-4 text-sm font-bold uppercase tracking-wider"
              href="/contribute"
            >
              Contribute →
            </Link>
          </div>
          <div className="border-drafting-cream/15 mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t pt-8">
            <p className="text-drafting-cream/40 font-mono text-xs uppercase tracking-[0.2em]">
              Jump to:
            </p>
            {catalogDimensions.map((d) => (
              <Link
                className="text-drafting-cream/70 hover:text-safety-yellow font-mono text-xs uppercase tracking-wider underline decoration-dotted underline-offset-4 transition-colors"
                href={d.href}
                key={d.href}
              >
                {d.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-blueprint-navy border-drafting-cream/10 border-t px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="text-drafting-cream/40 text-xs font-bold uppercase tracking-wider">
            Festivus
          </p>
          <p className="text-drafting-cream/30 text-xs">
            Open Source Physical AI for the Rest of Us by{" "}
            <a
              className="text-drafting-cream/50 underline decoration-dotted hover:text-drafting-cream"
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
