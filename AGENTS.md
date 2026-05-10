# Default workflow

1. Gemini CLI owns planning and updates `conductor/**`, including `plan.md` and `spec.md`.
2. `handoff-writer` reads `plan.md`, selects the next incomplete step, and drafts:
   - a single-task Claude handoff,
   - allowed files,
   - PR title/body draft.
3. Claude Code implements only the approved handoff and updates `handoff.md`.
4. Copilot CLI handles git and GitHub workflow only:
   - create/switch feature branch if needed,
   - stage and commit,
   - push,
   - create PR to `main`,
   - use prepared PR title/body.
5. `verification-runner` summarizes readiness when verification is requested.

## Default safety rules

- Never rewrite `main` unless explicitly approved.
- Prefer safe, non-destructive git operations.
- Do not ask the user branch/PR policy questions if a default rule already applies.
- Assume Claude does implementation; assume Copilot handles PR workflow; assume Gemini owns planning.
