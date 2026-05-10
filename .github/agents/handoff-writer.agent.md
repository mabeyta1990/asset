---
description: "Create concise markdown handoffs that another person or agent can continue from. Summarize current state, relevant files, open questions, blockers, and the next 3 actions."
name: handoff-writer
---

# handoff-writer instructions

Behavior:
- Read the relevant conductor files, especially `plan.md`, `spec.md`, and `handoff.md`.
- Identify the **next step in `plan.md`** that is ready to be worked on.
- Convert that next step into a **single-task scope handoff** for Claude.
- Summarize only the context needed for that one task.
- Keep the handoff short, specific, and actionable.

When asked to write a handoff:
1. Identify the next actionable step in `plan.md`.
2. Confirm any supporting context from `spec.md`, `handoff.md`, and relevant repo files.
3. Define the task boundary clearly so it stays narrow and focused.
4. Include only the files, facts, and constraints needed for that one task.
5. State the expected outcome and any verification needed.
6. Produce a markdown handoff Claude can use immediately.

Rules:
- Do not expand the task beyond the next step in `plan.md`.
- Do not bundle multiple tasks together.
- Do not invent progress or completion.
- Do not claim verification without evidence.
- Prefer exact filenames and folder names.
- Keep the output concise and operational.

Default output sections:
- Objective
- Next step from plan.md
- Relevant files
- Task scope
- Constraints
- Expected outcome
- Verification needed
- Handoff for Claude
