import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Todo, UpdateTodoInput } from "@full-stack-serverless/shared";

export class TodoConflictError extends Error {}
export class TodoNotFoundError extends Error {}

export interface TodoRepository {
  list(): Promise<Todo[]>;
  get(id: string): Promise<Todo | undefined>;
  create(todo: Todo): Promise<Todo>;
  update(id: string, input: UpdateTodoInput, updatedAt: string): Promise<Todo>;
  delete(id: string): Promise<void>;
}

function isConditionalCheckFailure(error: unknown): boolean {
  return (
    error instanceof Error && error.name === "ConditionalCheckFailedException"
  );
}

export class DynamoTodoRepository implements TodoRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async list(): Promise<Todo[]> {
    const result = await this.client.send(
      new ScanCommand({ TableName: this.tableName }),
    );
    return (result.Items as Todo[] | undefined) ?? [];
  }

  async get(id: string): Promise<Todo | undefined> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { id } }),
    );
    return result.Item as Todo | undefined;
  }

  async create(todo: Todo): Promise<Todo> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: todo,
          ConditionExpression: "attribute_not_exists(id)",
        }),
      );
      return todo;
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        throw new TodoConflictError(todo.id);
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateTodoInput,
    updatedAt: string,
  ): Promise<Todo> {
    const fields = Object.entries({ ...input, updatedAt });
    const names = Object.fromEntries(
      fields.map(([key], index) => [`#field${index}`, key]),
    );
    const values = Object.fromEntries(
      fields.map(([, value], index) => [`:value${index}`, value]),
    );
    try {
      const result = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { id },
          ConditionExpression: "attribute_exists(id)",
          UpdateExpression: `SET ${fields
            .map((_, index) => `#field${index} = :value${index}`)
            .join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        }),
      );
      return result.Attributes as Todo;
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        throw new TodoNotFoundError(id);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { id },
          ConditionExpression: "attribute_exists(id)",
        }),
      );
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        throw new TodoNotFoundError(id);
      }
      throw error;
    }
  }
}
