# G1 Laundry Folding — Proposed Data Additions (REVIEW ONLY)

**Status:** awaiting your review. **Nothing has been pushed to the database.**

Open the four JSON files in order, then tell me if you want to promote them into `data/policies_bulk.json`, `data/datasets_bulk.json`, and `data/compatibility_edges.json` (or a new file).

Every record has an explicit `hf_url` field — you asked for that. It's derivable from `hf_repo_id` / `hf_dataset_id`, but it's spelled out on every row so you never have to build the URL yourself.

## What's in this folder

| # | File | What it is | Records |
|---|---|---|---|
| 1 | `01-new-policies.json` | New policies to ADD to your policies catalog. These are the Unitree G1 fold policies that are missing. | 2 |
| 2 | `02-new-datasets.json` | New datasets to ADD to your datasets catalog. G1 fold-towel + clothes-to-washer + clothes-to-basket + Z1 fold-clothes. | 6 |
| 3 | `03-existing-policy-tagging.json` | EDITS to the 15 existing fold/cloth policies already in your catalog, setting `compatible_robot_slugs` to reality (none of them are actually G1-compatible). | 15 |
| 4 | `04-compat-edges.json` | 20 compat edges, one per (policy × `unitree-g1` × `fold-laundry`) cell. This is the answer to your original question, in the compat-edges shape the spec defined. | 20 |

## The headline

**Only 1 policy works on G1 for cloth folding today: `unitreerobotics/UnifoLM-VLA-Base`.** It's Tier 1 in `04-compat-edges.json` with status `validated`. Everything else in Tier 2 is `plausible-untested` — a documented fine-tuning path exists, but no one has published weights. Tier 3 is `incompatible` — hardware mismatch.

## Why your catalog looked like it had 9k policies but only 0 G1 fold candidates

The `compatible_robot_slugs` field on 94% of your 9,295 policies is a placeholder — 8,748 records claim compatibility with exactly 20 robot slugs (a scraper default, not real data). Only 2 policies mentioned G1/Unitree in that field, and neither was related to laundry. So the local filter couldn't answer "works on G1" from the existing data alone.

## What happens next (your call)

After you review the files:

1. **If they look right:** I promote the policy + dataset rows into `data/policies_bulk.json` + `data/datasets_bulk.json`, apply the tagging edits to the 15 existing cloth policies, and write the 20 compat edges into `data/compatibility_edges.json` (or a new `data/laundry_compat_edges.json` per spec 021).

2. **If you want changes:** tell me what to adjust before promotion.

3. **Push to `api.festivus.hapticlabs.ai`:** only after local promotion, local migration apply, and your go-ahead. That's a separate step — needs the production env + canary verification per the existing deploy playbook.

## Data provenance

Research conducted 2026-04-17. All HF and GitHub URLs were WebFetched during the research pass. Any field marked `null` means "research could not verify this" — no fabrication.
