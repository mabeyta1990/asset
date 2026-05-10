handoff-writer.agent.md

Purpose

Make handoff-writer generate a single, machine-readable draft for the next implementation step.

Required output (always):
- Next incomplete step from plan.md (one sentence identifier and reference to plan.md line/section when possible).
- Single-task Claude handoff: a short description of the task scope (one paragraph), files allowed to change, and any constraints.
- Allowed files: explicit, file-path list; no wildcards or directory-only patterns.
- PR title/body draft: a concise title and body (including verification notes and suggested reviewers).

Format
- Output as a YAML block with keys: step_id, step_summary, allowed_files (array), pr_title, pr_body, notes.
- Keep language deterministic and refrain from asking follow-up policy questions.

Best final shape
- Gemini: “update the plan.”
- Copilot handoff-writer: “draft next task.”
- Claude: “implement current handoff.”
- Copilot: “publish the PR.”
- Verification-runner: “summarize readiness.”
