import type { TaskStageKey } from "../types.js";

export type TaskMode = "create" | "patch" | "update";
export type ValidModel =
  | "tavily-search"
  | "nemotron-plan"
  | "nemotron-audit"
  | "nemotron-qa"
  | "claude-opus-4-7"
  | "claude-opus-4-6"
  | "claude-sonnet-4-6"
  | "claude-sonnet-4-5"
  | "claude-haiku-4-5"
  | "gemini-2-0"
  | "gemini-1-5-pro"
  | "glm-4"
  | "glm-3-turbo";

export interface TaskSpec {
  id: string;
  title: string;
  description: string;
  mode?: TaskMode;
  insertPath?: string;
  models?: Partial<Record<TaskStageKey, string>>;
}

const VALID_MODES: Set<string> = new Set(["create", "patch", "update"]);
const VALID_MODELS: Set<string> = new Set([
  "tavily-search",
  "nemotron-plan",
  "nemotron-audit",
  "nemotron-qa",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "gemini-2-0",
  "gemini-1-5-pro",
  "glm-4",
  "glm-3-turbo",
]);
const VALID_STAGE_KEYS: Set<string> = new Set(["research", "plan", "code", "audit"]);
const PATH_FORMAT_REGEX = /^[a-zA-Z0-9._\/-]+$/;

export interface ValidationError {
  field: string;
  message: string;
}

export function validateTaskSpec(input: unknown): { valid: true; data: TaskSpec } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!input || typeof input !== "object") {
    errors.push({
      field: "root",
      message: "Task specification must be an object",
    });
    return { valid: false, errors };
  }

  const obj = input as Record<string, unknown>;

  // Validate required fields
  if (typeof obj.id !== "string" || obj.id.trim() === "") {
    errors.push({
      field: "id",
      message: "id is required and must be a non-empty string",
    });
  }

  if (typeof obj.title !== "string" || obj.title.trim() === "") {
    errors.push({
      field: "title",
      message: "title is required and must be a non-empty string",
    });
  }

  if (typeof obj.description !== "string" || obj.description.trim() === "") {
    errors.push({
      field: "description",
      message: "description is required and must be a non-empty string",
    });
  }

  // Validate optional mode field
  if (obj.mode !== undefined) {
    if (typeof obj.mode !== "string") {
      errors.push({
        field: "mode",
        message: "mode must be a string",
      });
    } else if (!VALID_MODES.has(obj.mode)) {
      errors.push({
        field: "mode",
        message: `mode must be one of: ${Array.from(VALID_MODES).join(", ")}`,
      });
    }
  }

  // Validate optional insertPath field
  if (obj.insertPath !== undefined) {
    if (typeof obj.insertPath !== "string") {
      errors.push({
        field: "insertPath",
        message: "insertPath must be a string",
      });
    } else if (!PATH_FORMAT_REGEX.test(obj.insertPath)) {
      errors.push({
        field: "insertPath",
        message: "insertPath must contain only alphanumeric characters, dots, slashes, hyphens, and underscores",
      });
    }
  }

  // Validate optional models field
  if (obj.models !== undefined) {
    if (!obj.models || typeof obj.models !== "object" || Array.isArray(obj.models)) {
      errors.push({
        field: "models",
        message: "models must be an object",
      });
    } else {
      const modelsObj = obj.models as Record<string, unknown>;
      for (const [key, value] of Object.entries(modelsObj)) {
        if (!VALID_STAGE_KEYS.has(key)) {
          errors.push({
            field: `models.${key}`,
            message: `invalid stage key '${key}'. Must be one of: ${Array.from(VALID_STAGE_KEYS).join(", ")}`,
          });
        }
        if (typeof value !== "string") {
          errors.push({
            field: `models.${key}`,
            message: "model name must be a string",
          });
        } else if (!VALID_MODELS.has(value)) {
          errors.push({
            field: `models.${key}`,
            message: `'${value}' is not a valid model. Valid models are: ${Array.from(VALID_MODELS).join(", ")}`,
          });
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const validated: TaskSpec = {
    id: obj.id as string,
    title: obj.title as string,
    description: obj.description as string,
    mode: (obj.mode as TaskMode) || "create",
    insertPath: obj.insertPath as string | undefined,
    models: obj.models as Partial<Record<TaskStageKey, ValidModel>> | undefined,
  };

  return { valid: true, data: validated };
}

export function formatValidationErrors(errors: ValidationError[]): string {
  const lines = errors.map((err) => `  - ${err.field}: ${err.message}`);
  return `Task specification validation failed:\n${lines.join("\n")}`;
}
