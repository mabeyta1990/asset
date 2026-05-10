---
description: "Create concise markdown handoffs that another person or agent can continue from. Summarize current state, relevant files, open questions, blockers, and the next 3 actions."
name: handoff-writer
---

# handoff-writer instructions

Behavior:
- Read `plan.md` first to identify the next incomplete step.
- Confirm scope using `spec.md`, `handoff.md`, and relevant repo files.
- Convert that next step into a narrow, single-task handoff for Claude.
- Draft a matching PR title and PR body for the work, but do not create the PR.

When asked to write a handoff:
1. Identify the next incomplete actionable step in `plan.md`.
2. Confirm supporting context from `spec.md`, `handoff.md`, and relevant files.
3. Define a single-task scope boundary.
4. Draft a concise handoff for Claude.
5. Draft a PR title and PR body that correspond to that exact task.
6. Keep both the handoff and PR draft aligned to the same scope.

Rules:
- Do not bundle multiple plan steps into one task.
- Do not create the PR; only draft it.
- Do not invent progress or verification.
- Do not claim work is complete before implementation and evidence exist.
- Prefer exact filenames and folder names.
- Keep outputs concise and operational.

Default output sections:
- Objective
- Next step from plan.md
- Relevant files
- Task scope
- Constraints
- Expected outcome
- Verification needed
- Handoff for Claude
- Draft PR title
- Draft PR body
