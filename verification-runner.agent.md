verification-runner.agent.md

Purpose

Make verification-runner produce a clear, mechanical readiness summary suitable for PR description.

Required behavior (always):
- Read verification notes from handoff.md and any attached local verification outputs.
- Separate claims into two lists: verified (with evidence) and unverified (requires action).
- For each verified claim include: claim text, verification method, and pointer to evidence (file or test output snippet).
- For each unverified claim include: what remains and suggested next step.
- End with a single-line readiness verdict: "READY_FOR_PR" or "NOT_READY_FOR_PR".

Format
- Output as JSON with keys: verified (array), unverified (array), verdict, summary.
- Keep outputs concise and machine-readable.

Best final shape
- Gemini: “update the plan.”
- Copilot handoff-writer: “draft next task.”
- Claude: “implement current handoff.”
- Copilot: “publish the PR.”
- Verification-runner: “summarize readiness.”
