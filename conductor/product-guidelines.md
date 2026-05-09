# ASSET Product Guidelines

## Core Principles
1. **No model grades its own work.** The specification is the only common input across stages.
2. **Independence at every checkpoint.** At least three different models must touch every artifact before shipping.
3. **Cache reflects shipped state.** The canonical cache only updates upon a successful post-audit PASS.
4. **Failed runs don't pollute.** Session state is ephemeral; canonical state is durable.
5. **Sandbox isolation.** All code execution occurs in an isolated VM with read-only repo mounts.

## Prompting Discipline
- **Stable Prefix:** System roles, project context, and tool definitions should be cached.
- **Variable Suffix:** Specific tasks and session data should follow the cached context.

## State Management
- **Session State:** Per-pipeline-run data stored in `.ai-memory/sessions/`.
- **Canonical State:** Approved project state stored in `.ai-memory/canonical/`.
