# Prompting Guide

How to talk to agents in this repo effectively.

## 1. Philosophy

The more context lives in the harness (agent definitions, specs, brand
guide, coding guide, slash commands), the less context you need to
reconstruct in every prompt. A mature harness means shorter prompts
that focus on intent, not setup. See OpenAI's "Harness Engineering"
post (https://openai.com/index/harness-engineering/) for the broader
framing.

In this repo, CLAUDE.md is ~50 lines. Agent definitions carry domain
expertise. Slash commands encode workflows. Specs define requirements.
Your job as the prompter is to say what you want, not to re-explain
how the project works.

## 2. Three tiers of agent invocation

### Tier 1: Unnamed main thread
For questions, discussion, quick fixes, and routing help. You don't
name an agent. The main thread handles it directly or decides to
delegate based on the CLAUDE.md routing table.

Example: "Remove the Bring Your Agent button from the hero."

### Tier 2: Prefix hint
Write "@ui-designer rewrite the pillar copy" or "@canvas-agent fix
the card borders." The main thread interprets the prefix and handles
the task using the named agent's definition as context. Good for most
interactive single-agent work because you can iterate on the result.

Example: "@prompt-engineer add a rule that card clicks are browse
actions, not requests."

**Important: the prefix alone does not spawn a separate sub-agent.**
It is a hint the main thread interprets. The main thread may still
do the work itself.

### Tier 3: Explicit delegation (true spawn)
Write "delegate to @canvas-agent: build the three card types" or "use
the @ui-designer to build spec 002" or "spawn @prompt-engineer for the
full prompt rewrite." This triggers a true sub-agent spawn via the
Agent tool: isolated context window, full agent definition loaded,
single result returned.

Example: "Delegate to @ui-designer: rewrite the homepage per spec 001
v3. Read the spec first, build all 7 sections, run /check when done."

**Trigger phrases:** "delegate to," "use the [agent]," "spawn [agent]."

### When to force a true spawn (tier 3)

Use tier 3 when:
- The task will produce 100+ lines of code
- You can write a self-contained brief (no back-and-forth needed)
- You want to protect the main thread's context from file reads
- You're parallelizing: two agents working on independent files
- The main thread context is already cluttered

Use tier 2 when:
- You'll iterate on the result interactively
- The task is small enough that loading a full agent is overkill
- You need to see intermediate state before proceeding

### Agent cheat sheet

| Agent | Call this one for... | Typical tier |
|---|---|---|
| @canvas-agent | React Flow canvas, node cards, lanes, sidebar, SSE | 2 for fixes, 3 for builds |
| @agent-api | /api/agent route, tool defs, SSE streaming | 2 (usually small changes) |
| @prompt-engineer | System prompt voices, behavioral rules | 2 for rules, 3 for rewrites |
| @seed-data-agent | Seed JSON: robots, policies, envs, bounties | 2 for additions, 3 for research |
| @ui-designer | Frontend pages and components outside canvas | 2 for tweaks, 3 for full pages |
| @product-tester | Persona tests, conversation test fixtures | Usually 3, tier 2 for debugging a single test |
| @product-improver | Reading test reports, implementing fixes | Usually 3, tier 2 when iterating on a single failure |
| @schema-designer | Data models, type definitions, API shapes | 2 (usually advisory) |

## 3. Habits to drop

| Before (context-pasting) | After (harness-trusting) |
|---|---|
| "The brand colors are #0B1C36 navy, #EFECE4 cream, #FFD326 yellow. Use these for the new card." | "Build the new card. Follow docs/brand.md." |
| "The robot type is IRobot with fields name, manufacturer, hardware... here's the full interface..." | "Use the IRobot type from packages/types/." |
| "Valid robot slugs are so-100, koch-v11, aloha-2, franka-panda..." | "Use the slugs from the seed data. Don't hardcode from memory." |
| "After you're done, run pnpm typecheck and pnpm lint and make sure there are no errors." | "/check" |
| "Review the code for quality, then check brand consistency." | "/review" |
| "The system prompt is in apps/web/src/lib/agent/system-prompt.ts, the tool definitions are in tools.ts..." | "@prompt-engineer add a new behavioral rule for X." |

## 4. When to use /plan

Use `/plan <description>` when:
- Work touches more than one sub-agent's domain
- You're not sure about the approach and want to align first
- Work will span multiple turns or sessions
- Decisions made during execution need to be recorded for future sessions

Don't use /plan for single-file fixes, obvious bug fixes, or copy
changes. See docs/exec-plans/README.md for the full convention.

## 5. Fixing the harness vs fixing the prompt

**Rule of three:** if you've given the same instruction three times
across different conversations, it belongs in the harness, not in your
prompt. Move it to a slash command, agent definition, or doc file.

Symptoms of a harness gap:
- You keep pasting the same context paragraph
- An agent keeps making the same mistake despite corrections
- You find yourself explaining project conventions mid-task
- A slash command is missing for a workflow you do weekly

Fix the harness, then the prompt gets shorter automatically.

## 6. Diff review discipline

**Ask "show me the diff first" for harness files:**
- .claude/agents/*.md, .claude/commands/*.md, CLAUDE.md
- specs/, docs/brand.md, docs/coding-guide.md
- tests/REPORT-FORMAT.md, tests/TEST-ARCHITECTURE.md

These files change how agents think. Review before writing.

**Don't gate application code this way.** For page.tsx, canvas
components, seed JSON: let the agent write it, then review the result.
The /check and /review skills catch problems faster than pre-approval.

## 7. Trusting the feedback loops

Instead of asking the agent to "double check" or "make sure," delegate
verification to the harness:

| Don't say | Do say |
|---|---|
| "Make sure there are no type errors" | (run /check) |
| "Verify the brand colors are correct" | (run /review-brand) |
| "Check if the agent API still works" | (run /test-api) |
| "Did you update the specs?" | (run /update-docs) |
| "Test that the persona flow works" | (run /test smoke) |

The agent's self-assessment is less reliable than running the actual
tool. Let the tools do the verifying.

## 8. FAQ

**Q: Do I need to re-explain the project in every new conversation?**
No. CLAUDE.md, agent definitions, and docs/ are loaded automatically.
Start with what you want, not what the project is.

**Q: When should I invoke a sub-agent directly vs let the main thread decide?**
See the three tiers above. Tier 1 for exploration, tier 2 for focused
interactive work, tier 3 for large self-contained tasks.

**Q: Does prefixing with an agent name actually spawn a sub-agent?**
No. The prefix is a hint the main thread interprets. It helps with
routing but the main thread still handles the work in its own context.
To force a true sub-agent spawn (isolated context, full agent
definition), use explicit delegation: "delegate to @[agent]," "use
the @[agent]," or "spawn @[agent]."

**Q: How do I know if a slash command exists for what I need?**
Check .claude/commands/ or ask. Current skills: /check, /test,
/test-api, /update-docs, /review, /review-code, /review-brand,
/audit, /write-tests, /plan, /plan-done.

**Q: Should I ask the agent to commit and push?**
Only when you're ready. The agent won't commit unprompted. Say "git
commit and push" when the work is done.

**Q: The agent made a mistake that a skill should have caught. What now?**
Fix the skill, not the prompt. If /review-brand missed a voice
violation, update .claude/commands/review-brand.md so it catches it
next time.

**Q: How do I add a new agent or skill?**
Agent: create .claude/agents/name.md with 1-2 sentence description in
frontmatter, full context in body. Skill: create .claude/commands/name.md
with the workflow steps. Update CLAUDE.md routing table for agents.
