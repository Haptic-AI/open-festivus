# Data provenance

This file documents the upstream sources, license posture, and any
redactions applied to the JSON seed data in this directory. **PRs that
add data must update this file.**

The Festivus model is "code is open, data is curated." Every record
points users at the upstream canonical URL (HuggingFace, arXiv, GitHub,
manufacturer page) where the upstream license applies. Festivus does
NOT redistribute model weights, dataset blobs, or anything else for
which redistribution is restricted. It indexes references and adds a
typed schema on top.

## License inheritance

Records in this dataset are pointers, not copies. When a record
references a HuggingFace model whose license is `cc-by-nc-4.0`, the
Festivus record itself is Apache 2.0 (the repo license), but the
upstream artifact's license still governs any use of the artifact
itself. A user pulling a CC-BY-NC model based on a Festivus reference
must honor the upstream non-commercial term; Festivus does not
sublicense.

Where scraped description text contained personal email addresses,
those have been replaced with `<contact removed; see upstream>`. The
canonical text lives upstream.

## Per-domain summary

### `robots.json`

- Records: curated subset (used by the UI homepage and detail pages).
- Upstream: manufacturer spec pages (Boston Dynamics, Agility,
  Universal Robots, KUKA, ABB, FANUC, Dobot, Elephant Robotics, etc.)
  and named lab project pages.
- License: reference-only. Each record links the canonical product or
  project page; Festivus stores typed metadata (DOF, weight, sensors)
  rather than redistributing manufacturer documentation.
- Redactions: none.

### `robots_bulk.json`

- Records: 4378 robots scraped across HuggingFace model cards, GitHub
  READMEs, and manufacturer pages.
- Upstream: HF, GitHub, manufacturer pages.
- License: reference-only. Each record carries enough metadata to
  identify the upstream canonical entry; Festivus does not
  redistribute the upstream content beyond a description snippet.
- Redactions: 1 personal email scrubbed from a `description` field
  (record `mini-botics-minibot`). See "Redactions log" below.

### `robots_seed.json`

- Records: hand-curated subset of `robots.json` for the homepage
  carousel.
- Upstream: same as `robots.json`.
- License: reference-only.
- Redactions: none.

### `policies.json`

- Records: curated set tied to named papers and their HuggingFace
  model cards.
- Upstream: arXiv papers + HF model cards.
- License: per-record `license` field with values `mit`, `apache-2.0`,
  `bsd-3-clause`, `other`. License is the upstream artifact's
  license; Festivus only references the artifact.
- Redactions: none.

### `policies_bulk.json`

- Records: ~10k policies scraped from HuggingFace model cards.
- Upstream: HF model cards.
- License: per-record `license` field. Distribution across the
  corpus: ~6692 `unknown`, ~1264 `apache-2.0`, ~430 `mit`, ~200
  restricted-use (`cc-by-nc-*`, `openrail*`, `llama2/3`, `gemma`).
  These are tags on upstream artifacts; Festivus only cites the
  artifacts.
- Redactions: none.

### `datasets.json`

- Records: curated set tied to named lab papers (UT Austin, Stanford,
  Google Brain, Imperial College, University of Freiburg, etc.).
- Upstream: paper landing pages and HF dataset cards.
- License: reference-only. Each record links to the paper or HF
  dataset page where the upstream license applies.
- Redactions: none.

### `datasets_bulk.json`

- Records: 9962 datasets scraped from HuggingFace (7209 with explicit
  `hf_dataset_id`).
- Upstream: HF dataset cards.
- License: reference-only. Users follow `hf_dataset_id` to the
  canonical license on the dataset page.
- Redactions: 1 personal email scrubbed from a `description` field
  (record `sampade07-mmwave-radar-humanoid-intent-24ghz`).

### `benchmarks_bulk.json`

- Records: ~3k benchmarks from public suites (RLBench, ManiSkill,
  Behavior, etc.).
- Upstream: benchmark project pages.
- License: reference-only. Each record carries `source_url` to the
  upstream project.
- Redactions: none.

### `papers.json`

- Records: curated paper list.
- Upstream: arXiv.
- License: citation-only. Festivus stores the arXiv URL and metadata;
  no full-text reproduction.
- Redactions: none.

### `environments.json`

- Records: curated simulator scenes.
- Upstream: public simulators (MuJoCo, Isaac Gym, PyBullet scenes).
- License: reference-only. Each record links to the simulator
  project; no scene assets are redistributed here.
- Redactions: none.

### `tasks.json`

- Records: hand-authored task taxonomy.
- Upstream: original Haptic content.
- License: Apache 2.0 (the repo license).
- Redactions: N/A.

### `simulations.json`

- Records: internal pipeline output linking policy slugs, environment
  slugs, and robot slugs.
- Upstream: original Haptic content.
- License: Apache 2.0.
- Redactions: N/A.

### `compatibility_edges.json`

- Records: hand-authored compatibility claims, each with an
  `evidence_url`.
- Upstream: original Haptic claims; evidence URLs point at upstream
  papers, repos, or YouTube demos.
- License: Apache 2.0 for the claims; evidence URLs preserve the
  upstream license of the linked content.
- Redactions: N/A.

### `laundry_compat_edges.json`

- Records: hand-authored compatibility for the laundry-folding
  domain. Each edge carries `policy_license`.
- Upstream: original Haptic claims.
- License: Apache 2.0 for the claims.
- Redactions: N/A.

### `deploy-notes.json`

- Records: hand-authored deployment guidance per robot type.
- Upstream: original Haptic content.
- License: Apache 2.0.
- Redactions: N/A.

## Redactions log

- **2026-05-09:** Replaced an email (local-part `vesperbyar`, gmail
  domain) in `datasets_bulk.json` (record
  `sampade07-mmwave-radar-humanoid-intent-24ghz`) with the placeholder
  `<contact removed; see upstream>`. Source page on HuggingFace
  retains the original.
- **2026-05-09:** Replaced an email (local-part `romer.minibotics`,
  gmail domain) in `robots_bulk.json` (record `mini-botics-minibot`)
  with the same placeholder. Source repository retains the original.

## How records get added or fixed

- **Adding a robot, dataset, paper, environment, etc.**: use the
  in-app `/contribute` flow. Edits there land here through a
  moderator-curated pipeline.
- **Reporting a wrong reference**: open a "Data quality" GitHub Issue
  only if the in-app flow can't handle your case. See
  `.github/ISSUE_TEMPLATE/data_quality.yml`.
- **Adding a new domain**: requires a code PR (`data/<domain>.json`,
  schema in `packages/types`, scraping support). PRs that add a
  domain must update this file in the same commit.
