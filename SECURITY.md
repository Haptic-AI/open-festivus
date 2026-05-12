# Security policy

## Reporting a vulnerability

Email **moderator@hapticlabs.ai**. Include:

- A clear description of the issue.
- Steps to reproduce.
- Affected version (commit SHA, tag, or live URL).
- Your assessment of severity, if you have one.

Please do not open public GitHub issues for security findings. Public
disclosure before we have a fix gives attackers a head start on every
deployed instance.

## What to expect

- **Acknowledgement within 7 days.** A real human reads every report.
- **Status updates while we investigate.** No silent black box.
- **Coordinated disclosure within 90 days of your initial report.** If
  the fix takes longer, we'll explain why.
- **Credit on disclosure** if you want it. We respect anonymous
  reports.

## Scope

In scope:

- Code in this repository.
- Anything that lets an unauthenticated user read or modify data they
  should not be able to.
- Anything that lets an authenticated user escalate privileges.
- Secrets exposed in tracked code or git history.

Out of scope (not security bugs):

- Bugs that reproduce only against a hosted instance you don't run
  yourself. Report those to the operator of the instance.
- Missing security headers on landing pages with no user input.
- Self-XSS that requires the victim to paste attacker-supplied
  JavaScript into their own browser console.
- Volumetric denial-of-service (rate limiting is the operator's job).

## PGP

Not available at v0.1.0. If you have a sensitive payload that warrants
encryption, request a key in your initial email and we'll provision
one. Most reports do not need it.
