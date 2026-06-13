import type {
  CreateTodoInput,
  Todo,
  UpdateTodoInput,
} from "@full-stack-serverless/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createApp } from "../src/app.js";
import {
  TodoConflictError,
  TodoNotFoundError,
  type TodoRepository,
} from "../src/repositories/todo-repository.js";
import { TodoService } from "../src/services/todo-service.js";

const todo: Todo = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  title: "Test",
  description: "",
  completed: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createRepository(): TodoRepository {
  return {
    list: vi.fn(async () => [todo]),
    get: vi.fn(async () => todo),
    create: vi.fn(async (value: Todo) => value),
    update: vi.fn(
      async (_id: string, input: UpdateTodoInput, updatedAt: string) => ({
        ...todo,
        ...input,
        updatedAt,
      }),
    ),
    delete: vi.fn(async () => undefined),
  };
}

describe("Todo API", () => {
  let repository: TodoRepository;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    repository = createRepository();
    app = createApp({
      todoService: new TodoService(
        repository,
        () => new Date("2026-01-02T00:00:00.000Z"),
        () => todo.id,
      ),
    });
  });

  test("serves health and all CRUD endpoints", async () => {
    expect((await app.request("/api/health")).status).toBe(200);
    expect((await app.request("/api/todos")).status).toBe(200);
    expect((await app.request(`/api/todos/${todo.id}`)).status).toBe(200);

    const createResponse = await app.request("/api/todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: " New " } satisfies CreateTodoInput),
    });
    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toMatchObject({
      data: { title: "New", description: "", completed: false },
    });

    expect(
      (
        await app.request(`/api/todos/${todo.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ completed: true }),
        })
      ).status,
    ).toBe(200);
    expect(
      (await app.request(`/api/todos/${todo.id}`, { method: "DELETE" })).status,
    ).toBe(204);
  });

  test("returns validation errors for invalid JSON, schemas, and empty patch", async () => {
    for (const request of [
      app.request("/api/todos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      app.request("/api/todos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: " " }),
      }),
      app.request(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    ]) {
      expect((await request).status).toBe(400);
    }
  });

  test("maps repository errors without exposing internal details", async () => {
    vi.mocked(repository.get).mockResolvedValue(undefined);
    expect((await app.request(`/api/todos/${todo.id}`)).status).toBe(404);

    vi.mocked(repository.create).mockRejectedValue(new TodoConflictError());
    expect(
      (
        await app.request("/api/todos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Conflict" }),
        })
      ).status,
    ).toBe(409);

    vi.mocked(repository.delete).mockRejectedValue(new TodoNotFoundError());
    expect(
      (await app.request(`/api/todos/${todo.id}`, { method: "DELETE" })).status,
    ).toBe(404);

    vi.mocked(repository.list).mockRejectedValue(
      new Error("database credentials leaked"),
    );
    const response = await app.request("/api/todos");
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("credentials");
  });
});
