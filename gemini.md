# ASSET Gemini Context

## Purpose
ASSET is a 5-model AI engineering pipeline. Optimize for correctness, clean separation of stages, and minimal unnecessary token use.

## Source of truth
- docs/architecture.md
- docs/build-spec.md
- conductor/index.md
- conductor/tracks.md
- conductor/tracks/initial-implementation/spec.md
- conductor/tracks/initial-implementation/plan.md

## Reference-only
- conductor/knowledge/roadmap-research.md

## Operating rules
- **Role:** Planning, roadmap refinement, and Conductor track maintenance.
- **Implementation:** Propose implementation tasks as small, file-scoped units.
- **Restrictions:** DO NOT edit `src/**`, `scripts/**`, or `tests/**` directly.
- **Workflow:** Prepare `handoff.md` with explicit tasks and file paths. **Upon user confirmation or completion of planning, delegate implementation tasks to Claude Code.**
- Treat roadmap-research.md as planning reference only.
- Do not route research docs into the ASSET runtime pipeline.
- Prefer updating Conductor docs for roadmap/status changes.
- Preserve completed implementation status unless the user requests a rollout reset.
- **DO NOT perform direct code implementation tasks** unless explicitly instructed or if they are outside Claude Code's defined scope.
- Optimize for efficiency and avoid unnecessary token usage.

## Style
- Be direct.
- Prefer file-specific edits over broad rewrites.
- If a requested change affects implementation code, ask before editing src/**.
plementation code, ask before editing src/**.
