import {
  type CreateTodoInput,
  type Todo,
  TodoSchema,
  type UpdateTodoInput,
} from "@fsbg/shared";
import createClient from "openapi-fetch";
import type { paths } from "./generated/api";

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const client = createClient<paths>({ baseUrl });

function unwrap<T>(data: T | undefined, error: unknown): T {
  if (error || data === undefined) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "error" in error &&
      typeof error.error === "object" &&
      error.error !== null &&
      "message" in error.error
        ? String(error.error.message)
        : "API request failed";
    throw new Error(message);
  }
  return data;
}

export async function listTodos(): Promise<Todo[]> {
  const { data, error } = await client.GET("/api/todos");
  return unwrap(data, error).data.map((todo) => TodoSchema.parse(todo));
}

export async function createTodo(input: CreateTodoInput): Promise<Todo> {
  const { data, error } = await client.POST("/api/todos", {
    body: { ...input, description: input.description ?? "" },
  });
  return TodoSchema.parse(unwrap(data, error).data);
}

export async function updateTodo(
  id: string,
  input: UpdateTodoInput,
): Promise<Todo> {
  const { data, error } = await client.PATCH("/api/todos/{id}", {
    params: { path: { id } },
    body: input,
  });
  return TodoSchema.parse(unwrap(data, error).data);
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await client.DELETE("/api/todos/{id}", {
    params: { path: { id } },
  });
  if (error) {
    unwrap(undefined, error);
  }
}
