# ASSET Saturday Build Spec: 5-Hour Implementation Plan

## 1. File-by-File Implementation Order

### Phase 1: Core Wrappers & Caching (2h 00m)
1. `src/types.ts`: Define core interfaces (`StageOutput`, `SessionState`, `PromptConfig`).
2. `src/wrappers/claude.ts`: SDK-based wrapper with prompt caching support.
3. `src/wrappers/gemini.ts`: SDK-based wrapper with `cachedContents` lifecycle management.
4. `src/wrappers/perplexity.ts`: curl-based research wrapper.
5. `src/wrappers/glm.ts`: curl-based test/execution wrapper.
6. `src/wrappers/nemotron.ts`: curl-based audit wrapper (pre/post modes).

### Phase 2: Memory & Persistence (1h 00m)
7. `src/memory.ts`: Session state management (JSON writes to `.ai-memory/sessions/`).
8. `src/cache/canonical.ts`: Logic to read approved project state (schema, docs, code hash).
9. `src/cache/prefixes.ts`: Prompt templates for each stage (Stable vs. Variable).
10. `src/cache/refresh.ts`: Triggered on approval to update canonical pointers.

### Phase 3: Orchestration & CLI (1h 00m)
11. `src/pipeline.ts`: Main loop, stage sequencing, and retry logic.
12. `src/scripts/cli.ts`: Entry point for Warp; handles arguments and logging.

### Phase 4: VM & E2E Validation (1h 00m)
13. `scripts/setup-vm.sh`: Automation for OrbStack/Ubuntu setup.
14. End-to-end smoke test using `npm run asset`.

---

## 2. Core Caching Patterns

### Claude (Anthropic SDK)
**Goal:** Cache the system prompt and codebase context.
```typescript
const response = await anthropic.messages.create({
  model: "claude-opus-4-7",
  max_tokens: 4096,
  system: [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" } // MARKER
    }
  ],
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: CODEBASE_CONTEXT,
          cache_control: { type: "ephemeral" } // MARKER
        },
        {
          type: "text",
          text: VARIABLE_TASK_CONTENT // NO MARKER
        }
      ]
    }
  ]
});
```

### Gemini (Google AI SDK)
**Goal:** Use `GoogleAICacheManager` for long-lived project context (TTL 24h).
*Note: Requires minimum 32,768 tokens for explicit caching.*
```typescript
import { GoogleAICacheManager } from "@google/generative-ai/server";

// 1. Manage cache lifecycle
const cacheManager = new GoogleAICacheManager(API_KEY);

// 2. Create if missing (check by displayName or store name in .ai-memory)
const cache = await cacheManager.create({
  model: "models/gemini-2.5-pro",
  displayName: "asset-canonical-context",
  systemInstruction: SYSTEM_PROMPT,
  contents: [
    { role: "user", parts: [{ text: STABLE_CONTEXT }] }
  ],
  ttlSeconds: 86400, // 24 hours
});

// 3. Use the cache in a session
const model = genAI.getGenerativeModel(
  { model: "models/gemini-2.5-pro" },
  { cachedContent: cache.name }
);
const result = await model.generateContent(VARIABLE_TASK);
```

---

## 3. Smoke Test Commands

| Component | Command | Success Metric |
|---|---|---|
| **Claude** | `tsx src/wrappers/claude.ts --test` | `cache_read_input_tokens > 0` (on 2nd run) |
| **Gemini** | `tsx src/wrappers/gemini.ts --test` | `usageMetadata.cachedContentTokenCount > 0` |
| **Perplexity** | `tsx src/wrappers/perplexity.ts --test` | Valid JSON with `citations` field |
| **GLM** | `tsx src/wrappers/glm.ts --test` | HTTP 200 with generated code/tests |
| **Nemotron** | `tsx src/wrappers/nemotron.ts --test` | Response containing "PASS" or "FAIL" |
| **Pipeline** | `npm run asset "hello world"` | All 7 JSON files present in `.ai-memory/sessions/` |

---

## 4. OrbStack VM Setup Steps

1. **Create VM:**
   ```bash
   orb create ubuntu asset-exec
   ```
2. **Mount Workspace:**
   Configure OrbStack to mount `~/Developer/asset` to `/workspace` (Read-only).
   Configure `.ai-memory/sessions` to `/output` (Read-Write).
3. **Install Dependencies in VM:**
   ```bash
   orb -m asset-exec sudo apt update && sudo apt install -y nodejs npm
   ```
4. **Verify VM Environment:**
   ```bash
   orb -m asset-exec node --version
   orb -m asset-exec ls /workspace/package.json
   ```
5. **Verify Mounts:**
   ```bash
   orb -m asset-exec ls /workspace/package.json
   ```

---

## 5. 5-Hour Time-Blocked Schedule

| Time Slot | Goal | Deliverables |
|---|---|---|
| **09:00 - 11:00** | **Phase 1: Wrappers** | All 5 wrappers working + Caching verified. |
| **11:00 - 12:00** | **Phase 2: Memory** | `memory.ts` and `canonical.ts` reading/writing JSON correctly. |
| **12:00 - 12:30** | *Quick Break* | — |
| **12:30 - 13:30** | **Phase 3: Pipeline** | `pipeline.ts` orchestrating stages; `cli.ts` operational. |
| **13:30 - 14:30** | **Phase 4: VM & E2E** | VM configured; Successful "Hello World" pipeline run. |

---

## Technical Constraints
- **Strict Isolation:** Curl wrappers must use `execFile` to prevent shell injection.
- **Ephemeral State:** Session directories must be timestamped.
- **Fail Fast:** Pipeline should exit if [A] or [S] stages fail more than 3 times.
