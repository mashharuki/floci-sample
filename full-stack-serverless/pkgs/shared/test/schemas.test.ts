import { describe, expect, test } from "vitest";
import {
  CreateTodoSchema,
  TodoSchema,
  UpdateTodoSchema,
  errorResponse,
} from "../src/index.js";

describe("Todo schemas", () => {
  test("accepts title boundaries and defaults description", () => {
    expect(CreateTodoSchema.parse({ title: " a " })).toEqual({
      title: "a",
      description: "",
    });
    expect(CreateTodoSchema.safeParse({ title: "x".repeat(100) }).success).toBe(
      true,
    );
    expect(CreateTodoSchema.safeParse({ title: "x".repeat(101) }).success).toBe(
      false,
    );
  });

  test("validates UUID and ISO timestamps", () => {
    expect(
      TodoSchema.safeParse({
        id: "not-a-uuid",
        title: "Todo",
        description: "",
        completed: false,
        createdAt: "today",
        updatedAt: "today",
      }).success,
    ).toBe(false);
  });

  test("rejects an empty patch", () => {
    expect(UpdateTodoSchema.safeParse({}).success).toBe(false);
  });

  test("creates the standard error envelope", () => {
    expect(errorResponse("TODO_NOT_FOUND", "missing")).toEqual({
      error: { code: "TODO_NOT_FOUND", message: "missing" },
    });
  });
});
