import { describe, it, expect } from "vitest";
import { validateTaskSpec, formatValidationErrors } from "./types/task-spec.js";

describe("Task Spec Validation", () => {
  describe("Valid specifications", () => {
    it("should validate a minimal valid spec with required fields only", () => {
      const spec = {
        id: "task-1",
        title: "Test Task",
        description: "A task description",
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.id).toBe("task-1");
        expect(result.data.mode).toBe("create");
      }
    });

    it("should validate a spec with all fields", () => {
      const spec = {
        id: "task-2",
        title: "Full Task",
        description: "Complete task specification",
        mode: "patch",
        insertPath: "src/components/index.ts",
        models: {
          code: "claude-opus-4-7",
          plan: "nemotron-plan",
        },
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.mode).toBe("patch");
        expect(result.data.insertPath).toBe("src/components/index.ts");
      }
    });

    it("should accept all valid modes", () => {
      const modes = ["create", "patch", "update"];

      for (const mode of modes) {
        const spec = {
          id: "test",
          title: "Test",
          description: "Test",
          mode: mode as any,
        };

        const result = validateTaskSpec(spec);
        expect(result.valid).toBe(true);
      }
    });

    it("should accept all valid models", () => {
      const validModels = [
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
      ];

      for (const model of validModels) {
        const spec = {
          id: "test",
          title: "Test",
          description: "Test",
          models: {
            code: model as any,
          },
        };

        const result = validateTaskSpec(spec);
        expect(result.valid, `Model ${model} should be valid`).toBe(true);
      }
    });

    it("should accept partial model overrides", () => {
      const spec = {
        id: "test",
        title: "Test",
        description: "Test",
        models: {
          code: "claude-haiku-4-5",
        },
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.models?.code).toBe("claude-haiku-4-5");
      }
    });

    it("should accept valid file paths for insertPath", () => {
      const validPaths = [
        "src/index.ts",
        "src/components/Button.tsx",
        "lib/utils.js",
        "test-file.ts",
        "src_v2/index.ts",
        "src-old/index.ts",
        "src/nested/deep/path.ts",
      ];

      for (const path of validPaths) {
        const spec = {
          id: "test",
          title: "Test",
          description: "Test",
          insertPath: path,
        };

        const result = validateTaskSpec(spec);
        expect(result.valid, `Path ${path} should be valid`).toBe(true);
      }
    });

    it("should default mode to 'create' when not provided", () => {
      const spec = {
        id: "test",
        title: "Test",
        description: "Test",
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.mode).toBe("create");
      }
    });
  });

  describe("Invalid specifications", () => {
    it("should fail validation when id is missing", () => {
      const spec = {
        title: "Test Task",
        description: "A task description",
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field.includes("id"))).toBe(true);
      }
    });

    it("should fail validation when id is empty string", () => {
      const spec = {
        id: "",
        title: "Test Task",
        description: "A task description",
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field.includes("id"))).toBe(true);
      }
    });

    it("should fail validation when title is missing", () => {
      const spec = {
        id: "task-1",
        description: "A task description",
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field.includes("title"))).toBe(true);
      }
    });

    it("should fail validation when description is missing", () => {
      const spec = {
        id: "task-1",
        title: "Test Task",
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field.includes("description"))).toBe(true);
      }
    });

    it("should fail validation on invalid mode", () => {
      const spec = {
        id: "task-1",
        title: "Test Task",
        description: "A task description",
        mode: "delete",
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field.includes("mode"))).toBe(true);
      }
    });

    it("should fail validation on invalid model", () => {
      const spec = {
        id: "task-1",
        title: "Test Task",
        description: "A task description",
        models: {
          code: "invalid-model-name",
        },
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field.includes("models"))).toBe(true);
      }
    });

    it("should fail validation on invalid insertPath with special characters", () => {
      const invalidPaths = [
        "src/<invalid>",
        "src/|bad",
        "src\\windows\\path",
        "src/path with spaces.ts",
        "src/path@invalid.ts",
      ];

      for (const path of invalidPaths) {
        const spec = {
          id: "test",
          title: "Test",
          description: "Test",
          insertPath: path,
        };

        const result = validateTaskSpec(spec);
        expect(result.valid, `Path ${path} should be invalid`).toBe(false);
      }
    });

    it("should fail validation when invalid task stage key is in models", () => {
      const spec = {
        id: "task-1",
        title: "Test Task",
        description: "A task description",
        models: {
          invalid_stage: "claude-haiku-4-5",
        },
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field.includes("models"))).toBe(true);
      }
    });

    it("should report multiple errors when multiple fields are invalid", () => {
      const spec = {
        id: "",
        title: "",
        description: "",
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(1);
      }
    });
  });

  describe("Error formatting", () => {
    it("should format validation errors with clear messages", () => {
      const spec = {
        id: "",
        title: "Test",
        description: "Test",
        mode: "invalid",
      };

      const result = validateTaskSpec(spec);
      expect(result.valid).toBe(false);

      if (!result.valid) {
        const formatted = formatValidationErrors(result.errors);
        expect(formatted).toContain("Task specification validation failed");
        expect(formatted).toContain("id");
        expect(formatted).toContain("mode");
      }
    });

    it("should show field path in error messages", () => {
      const spec = {
        id: "test",
        title: "Test",
        description: "Test",
        models: {
          code: "invalid-model",
        },
      };

      const result = validateTaskSpec(spec);
      expect(result.valid).toBe(false);

      if (!result.valid) {
        const formatted = formatValidationErrors(result.errors);
        expect(formatted).toContain("models");
      }
    });
  });

  describe("Type validation", () => {
    it("should reject non-object input", () => {
      const result = validateTaskSpec("not an object");

      expect(result.valid).toBe(false);
    });

    it("should reject null input", () => {
      const result = validateTaskSpec(null);

      expect(result.valid).toBe(false);
    });

    it("should reject undefined input", () => {
      const result = validateTaskSpec(undefined);

      expect(result.valid).toBe(false);
    });

    it("should handle numeric fields gracefully", () => {
      const spec = {
        id: 123,
        title: "Test",
        description: "Test",
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(false);
    });
  });

  describe("Schema inference", () => {
    it("should allow TypeScript to infer the TaskSpec type", () => {
      const spec = {
        id: "test",
        title: "Test",
        description: "Test",
        mode: "patch" as const,
        insertPath: "src/index.ts",
      };

      const result = validateTaskSpec(spec);

      expect(result.valid).toBe(true);
      if (result.valid) {
        const typedSpec: typeof result.data = result.data;
        expect(typedSpec.mode).toBe("patch");
      }
    });
  });
});
