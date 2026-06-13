import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, test, vi } from "vitest";
import {
  DynamoTodoRepository,
  TodoConflictError,
  TodoNotFoundError,
} from "../src/repositories/todo-repository.js";

const todo = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  title: "Test",
  description: "",
  completed: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createClient() {
  const send = vi.fn();
  return {
    send,
    client: { send } as unknown as DynamoDBDocumentClient,
  };
}

describe("DynamoTodoRepository", () => {
  test("uses a uniqueness condition when creating", async () => {
    const { client, send } = createClient();
    send.mockResolvedValue({});
    await new DynamoTodoRepository(client, "Todos").create(todo);
    expect(send.mock.calls[0]?.[0].input).toMatchObject({
      TableName: "Todos",
      ConditionExpression: "attribute_not_exists(id)",
    });
  });

  test("maps conditional create conflicts", async () => {
    const { client, send } = createClient();
    const error = new Error("conflict");
    error.name = "ConditionalCheckFailedException";
    send.mockRejectedValue(error);
    await expect(
      new DynamoTodoRepository(client, "Todos").create(todo),
    ).rejects.toBeInstanceOf(TodoConflictError);
  });

  test("uses existence conditions and maps missing updates and deletes", async () => {
    const { client, send } = createClient();
    const repository = new DynamoTodoRepository(client, "Todos");
    const error = new Error("missing");
    error.name = "ConditionalCheckFailedException";
    send.mockRejectedValue(error);

    await expect(
      repository.update(todo.id, { completed: true }, todo.updatedAt),
    ).rejects.toBeInstanceOf(TodoNotFoundError);
    expect(send.mock.calls[0]?.[0].input.ConditionExpression).toBe(
      "attribute_exists(id)",
    );

    await expect(repository.delete(todo.id)).rejects.toBeInstanceOf(
      TodoNotFoundError,
    );
    expect(send.mock.calls[1]?.[0].input.ConditionExpression).toBe(
      "attribute_exists(id)",
    );
  });
});
