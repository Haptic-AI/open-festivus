# Schema preview — what will land in the database

Four files, four shapes. This doc shows each shape with one sample row. **Nothing has been pushed yet.**

---

## 📄 File 01 — `01-new-policies.json` (2 records)

Adds 2 new policies to `data/policies_bulk.json`.

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `slug` | string | unique id for Festivus |
| `name` | string | display name |
| `hf_repo_id` | string | HuggingFace owner/repo |
| `hf_url` | string | full HuggingFace URL (you asked for this) |
| `paper_arxiv_url` | string \| null | arXiv paper if any |
| `github_repo_url` | string \| null | GitHub repo if any |
| `author` | string | publishing org |
| `license` | string | canonical license id |
| `license_short` | string | plain-English license class (you asked for this) |
| `framework` | string | architecture family (unifolm-vla, pi05, etc.) |
| `skill_type` | string | manipulation-foundation, etc. |
| `task_description` | string | 1–3 sentences on what this policy does |
| `action_space` | string | action space summary |
| `observation_space` | string | observation space summary |
| `compatible_robot_slugs` | string[] | ROBOT slugs this policy actually runs on (verified, not placeholder) |
| `compatible_env_slugs` | string[] | environments (real, libero, isaac-lab, etc.) |
| `evidence_level` | string | validated / reported / plausible |
| `taxonomy` | object | category/subcategory/modality/embodiment |
| `benchmarks` | string[] | benchmark slugs |
| `training_datasets` | string[] | HF dataset ids used to train |
| `verified_hardware` | string[] | hardware confirmed by the HF card |
| `verified_via_url` | string | the exact URL that proved it |
| `verified_at` | string | ISO date |
| `provenance_notes` | string | honest notes on what was verified vs assumed |

**Sample row (truncated):**

```json
{
  "slug": "unitreerobotics-unifolm-vla-base",
  "name": "UnifoLM-VLA-Base",
  "hf_repo_id": "unitreerobotics/UnifoLM-VLA-Base",
  "hf_url": "https://huggingface.co/unitreerobotics/UnifoLM-VLA-Base",
  "author": "Unitree Robotics",
  "license": "cc-by-nc-sa-4.0",
  "license_short": "non-commercial",
  "framework": "unifolm-vla",
  "compatible_robot_slugs": ["unitree-g1"],
  "evidence_level": "validated",
  "verified_hardware": ["unitree-g1"],
  "verified_via_url": "https://huggingface.co/unitreerobotics/UnifoLM-VLA-Base",
  "provenance_notes": "This is the ONLY currently-published policy with real G1 fold training."
}
```

---

## 📄 File 02 — `02-new-datasets.json` (6 records)

Adds 6 new datasets to `data/datasets_bulk.json`.

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `slug` | string | unique id |
| `name` | string | display name |
| `hf_dataset_id` | string | HuggingFace owner/dataset |
| `hf_url` | string | full HuggingFace URL |
| `description` | string | what the dataset contains |
| `episodes` | int \| null | episode count |
| `robots` | int | number of robot embodiments in it |
| `robot_names` | string[] | robot slugs |
| `source` | string | publishing org |
| `format` | string | lerobot, rlds, other |
| `license` | string | canonical license id |
| `license_short` | string | plain-English license class |
| `frames_or_rows` | int \| null | frames or DB rows |
| `fps` | int \| null | recording rate |
| `cameras` | int \| null | number of cameras |
| `task_slug` | string | task category (fold-towel, put-clothes-into-washing-machine) |
| `compatible_policy_slugs` | string[] | policies trained on this dataset |
| `verified_at` | string | ISO date |
| `provenance_notes` | string | honest notes |

**Sample row:**

```json
{
  "slug": "unitreerobotics-g1-dex1-fold-towel",
  "name": "G1 Dex1 Fold Towel",
  "hf_dataset_id": "unitreerobotics/G1_Dex1_Fold_Towel",
  "hf_url": "https://huggingface.co/datasets/unitreerobotics/G1_Dex1_Fold_Towel",
  "episodes": 200,
  "robot_names": ["unitree-g1"],
  "source": "unitreerobotics",
  "format": "lerobot",
  "license": "apache-2.0",
  "license_short": "commercial-ok",
  "frames_or_rows": 311000,
  "task_slug": "fold-towel",
  "compatible_policy_slugs": ["unitreerobotics-unifolm-vla-base"]
}
```

---

## 📄 File 03 — `03-existing-policy-tagging.json` (15 records)

**Edits** to 15 existing policies in `data/policies_bulk.json`. Sets `compatible_robot_slugs` to reality (previously a placeholder that claimed compat with 20 random robots).

**Fields per edit:**

| Field | Type | Purpose |
|---|---|---|
| `slug` | string | the policy being updated |
| `hf_repo_id` | string \| null | existing HF id (read-only, for reference) |
| `hf_url` | string \| null | full HF URL (for reference) |
| `edits.verified_hardware` | string[] | what it's ACTUALLY trained on (e.g. `["so-101-bimanual"]`) |
| `edits.verified_hardware_note` | string | 1 sentence explaining the verification |
| `edits.compatible_robot_slugs_proposed` | string[] | the replacement for the broken `compatible_robot_slugs` field |
| `edits.g1_compatible` | bool | does this policy work on G1? (all false in this batch) |
| `edits.g1_compatible_note` | string | why not G1? |
| `edits.verified_at` | string | ISO date |
| `edits.verified_via_url` | string | the URL that proved it |

**Sample edit:**

```json
{
  "slug": "zekai-chen-pi05-fold-towel",
  "hf_url": "https://huggingface.co/Zekai-Chen/pi05_fold_towel",
  "edits": {
    "verified_hardware": ["so-101-bimanual"],
    "verified_hardware_note": "Trained on SO-100/SO-101 bimanual teleop.",
    "compatible_robot_slugs_proposed": ["so-101"],
    "g1_compatible": false,
    "g1_compatible_note": "SO-101 action space (14 DoF) incompatible with G1 kinematics.",
    "verified_at": "2026-04-17",
    "verified_via_url": "https://huggingface.co/Zekai-Chen/pi05_fold_towel"
  }
}
```

---

## 📄 File 04 — `04-compat-edges.json` (9 records — Tier 1 + Tier 2 only)

This is the answer to your original question, in compat-edge shape. **Filtered to Tier 1 + Tier 2 only** as you asked — no long shots.

**Fields:**

| Field | Type | Purpose |
|---|---|---|
| `slug` | string | unique edge id (`<robot>__<policy>__<task>__<env>`) |
| `robot_slug` | string | always `unitree-g1` in this file |
| `policy_slug` | string | the policy |
| `policy_name` | string | display name |
| `policy_hf_url` | string \| null | full HF URL (you asked for this) |
| `task_slug` | string | always `fold-laundry` |
| `tier` | int | 1 = works today, 2 = plausible with fine-tuning |
| `status` | string | `validated` / `plausible-untested` |
| `environment` | string | `real` / `libero` |
| `simulator_first` | bool | sim-evidenced vs real-evidenced |
| `evidence_type` | string | `hf-card` / `documented-recipe` / `cross-embodiment-reference` |
| `evidence_url` | string | primary source |
| `additional_evidence_urls` | string[] | corroborating sources |
| `policy_license` | string | canonical license id |
| `license_short` | string | plain-English license class |
| `confidence` | string | high / medium / low |
| `notes` | string | honest 1-paragraph take |
| `sourced_at` | string | ISO date |

**Sample row (Tier 1 — the only `validated` edge):**

```json
{
  "slug": "unitree-g1__unitreerobotics-unifolm-vla-base__fold-laundry__real",
  "robot_slug": "unitree-g1",
  "policy_slug": "unitreerobotics-unifolm-vla-base",
  "policy_name": "UnifoLM-VLA-Base",
  "policy_hf_url": "https://huggingface.co/unitreerobotics/UnifoLM-VLA-Base",
  "task_slug": "fold-laundry",
  "tier": 1,
  "status": "validated",
  "environment": "real",
  "policy_license": "cc-by-nc-sa-4.0",
  "license_short": "non-commercial",
  "confidence": "high"
}
```

---

## Summary of what will land

| File | Records | Action | Target file |
|---|---|---|---|
| `01-new-policies.json` | 2 | ADD | `data/policies_bulk.json` |
| `02-new-datasets.json` | 6 | ADD | `data/datasets_bulk.json` |
| `03-existing-policy-tagging.json` | 15 | UPDATE in place | `data/policies_bulk.json` |
| `04-compat-edges.json` | 9 | ADD | `data/laundry_compat_edges.json` (new file, per spec 021) |

License breakdown across all records:
- `commercial-ok`: 13 records (Apache-2.0 / MIT)
- `non-commercial`: 3 records (Unitree CC BY-NC-SA)
- `check-terms`: 1 record (NVIDIA TOS)

HF URL coverage: 100% of new records have `hf_url` or `hf_dataset_id`. The one legacy edit entry without HF (`avsurfer123-cloth-manipulation`, PR2 GitHub-only) was dropped when filtering to Tier 1+2.

---

## 🚦 Publish? Reply with one of

- **`publish OK`** — I merge all 4 files into `data/policies_bulk.json`, `data/datasets_bulk.json`, apply the 15 tagging edits, and write the 9 edges into `data/laundry_compat_edges.json`. Local only — still not pushed to `api.festivus.hapticlabs.ai`.
- **`publish NO`** — I stop. Tell me what to change and I iterate.

(After `publish OK` lands locally, the next step is the API deploy to `api.festivus.hapticlabs.ai` — that's a separate, explicit gate with its own canary check.)
