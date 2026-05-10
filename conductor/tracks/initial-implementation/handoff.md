# Handoff: Next Task

## Pending Tasks
- [ ] **Multi-File Generation**
    - [ ] Extend task spec to declare multiple output files.
    - [ ] Define code-stage output schema as `files: { path, content }[]`.
    - [ ] Stage each generated file independently in the session workspace.
    - [ ] Validate all generated files before any promotion occurs.
    - [ ] Promote all files atomically as a single batch.
    - [ ] Fail the whole batch if any file fails `tsc`, `vitest`, or audit.
    - [ ] Add unit/integration coverage for partial-failure rollback.

## Context
The pipeline optimization and audit refactor (v3) is complete. The next major architectural step is supporting multiple output files in a single task.
