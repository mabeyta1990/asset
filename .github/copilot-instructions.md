# Copilot workflow rules

Copilot CLI is the GitHub workflow agent for this repository.

## Responsibilities
- Read the current handoff and PR draft.
- Handle git and GitHub actions only: branch, commit, push, PR creation, PR comments.
- Do not re-implement work Claude has already completed.
- Do not redefine planning scope.

## Branch and PR defaults
- If implementation is complete and no feature branch exists, create a feature branch from current `main`.
- Open the PR from the feature branch into `main`.
- Prefer safe, non-destructive options.
- If implementation landed on `main` accidentally, prefer revert-based recovery over force-reset.
- Use the prepared PR title/body when available.
