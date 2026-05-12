# Contributing to Festivus

Thanks for your interest. Two paths in.

## Code changes go through GitHub PRs

If you're fixing a bug, adding a feature, or improving docs, open a PR
against `main` here.

### Setup

Follow the [Quickstart in the README](README.md#-quickstart). You'll
have web on `:3000` and api on `:8000` after about ten minutes.

### Running tests

```bash
pnpm check     # typecheck + lint, zero warnings
pnpm test      # the full suite
```

Both must pass before you open the PR. CI runs the same commands.

### Code style

See [`docs/coding-guide.md`](docs/coding-guide.md). Highlights:

- TypeScript everywhere. No `any`. No `console.log`. No non-null
  assertions (`!`).
- Interface names prefixed with `I` (e.g. `IBlogPost`).
- Use `import type` for type-only imports.
- Copy style: no em dashes, use "Physical AI" not "robotics."

### DCO sign-off

Every commit must include a `Signed-off-by: Your Name <your@email>`
trailer. The easiest way is `git commit -s`. To amend an existing commit
that's missing it, run `git commit --amend -s`.

By signing off you certify the [Developer Certificate of Origin](https://developercertificate.org/):
in plain English, that you wrote the code (or have permission to
contribute it), and you license it under Apache 2.0.

A GitHub Actions workflow checks this on every PR. PRs without sign-off
will not pass CI.

### PR flow

1. Open a PR against `main`. Fill out the template.
2. A maintainer reviews. Discussion happens in the PR.
3. On approval, the maintainer merges to `main`. CI runs again on
   `main`.
4. Within one business day, the maintainer cherry-picks the change
   inward to the internal monorepo where Festivus is primarily
   developed. This is invisible to you. Your contribution is the
   public commit on `main`.

## Record changes go through `/contribute`, not GitHub

If you want to add a robot, fix a dataset description, flag a broken
policy link, or claim that two pieces of hardware are
software-compatible, do it through the in-app `/contribute` flow at
https://festivus.hapticlabs.ai/contribute.

The flow has typed forms, validation, and a moderator queue. Trying to
do the same edit as a GitHub PR against `data/*.json` will be closed
with a pointer back to `/contribute`. The model is "code is open, data
is curated."

The single exception: if `/contribute` itself is broken (the form
crashes, the API returns 500, etc.), open a GitHub Issue using the
"Data quality" template.

## Asking questions

For questions, design discussions, and "I'm trying to use this for X" 
threads, open a [GitHub Discussion](https://github.com/Haptic-AI/open-festivus/discussions).
Issues are for confirmed bugs and concrete feature requests, not
open-ended questions.

## Reporting security issues

Don't open a public issue for security. See [`SECURITY.md`](SECURITY.md)
for the private disclosure channel.
