# ASSET Pipeline Workflow

## 1. Analysis [A]
- **Goal:** Fresh research and requirement gathering.
- **Model:** Perplexity Sonar.
- **Output:** Research JSON.

## 2. Strategy [S]
- **Goal:** High-level planning and explicit test case definition.
- **Model:** Gemini Pro.
- **Output:** Implementation plan JSON.

## 3. Scripting [S]
- **Implementation:** Claude Opus 4.7 generates code (no tests).
- **Test Generation:** GLM-5.1 generates tests in a separate context based on the spec.

## 4. Evaluation [E]
- **Pre-Audit:** Nemotron reviews code and tests against the spec.
- **Execution:** GLM executes tests in an Ubuntu VM sandbox.
- **Post-Audit:** Nemotron reviews execution results against the spec.

## 5. Trust [T]
- **Approval Gate:** Final human/automated check.
- **Action:** Write files to repo, update roadmap, refresh canonical caches.
