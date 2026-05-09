# ASSET Tech Stack

## Orchestration
- **Runtime:** Node.js 20+
- **Language:** TypeScript
- **CLI:** tsx (for running scripts), Warp (entry point)

## AI Models & SDKs
- **Analysis [A]:** Perplexity Sonar (Research) - via `curl`
- **Strategy [S]:** Gemini Pro (Planning) - via `@google/generative-ai` (Context Caching)
- **Scripting [S]:** Claude Opus 4.7 (Coding) - via `@anthropic-ai/sdk` (Prompt Caching)
- **Scripting/Evaluation [S/E]:** GLM-5.1 (Tests & Execution) - via `curl`
- **Evaluation [E]:** Nemotron 3 Super (Auditing) - via `curl` (DeepInfra)

## Infrastructure & State
- **Execution Sandbox:** OrbStack with Ubuntu VM
- **Secret Management:** Doppler
- **Communication:** Slack Webhooks
- **Spec Management:** Notion via MCP
- **Persistence:** Local JSON-based session and canonical state management
