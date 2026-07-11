import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  ApiErrorSchema,
  HealthResponseSchema,
  errorResponse,
} from "@fsbg/shared";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import {
  DynamoTodoRepository,
  TodoConflictError,
  TodoNotFoundError,
} from "./repositories/todo-repository.js";
import {
  createTodoRoute,
  deleteTodoRoute,
  getTodoRoute,
  listTodosRoute,
  updateTodoRoute,
} from "./routes/todos.js";
import { TodoService } from "./services/todo-service.js";

export interface AppDependencies {
  todoService: TodoService;
  color?: "blue" | "green";
}

const healthRoute = createRoute({
  method: "get",
  path: "/api/health",
  responses: {
    200: {
      content: { "application/json": { schema: HealthResponseSchema } },
      description: "Health status",
    },
    500: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "Internal error",
    },
  },
});

function jsonError(
  c: Parameters<Parameters<OpenAPIHono["onError"]>[0]>[1],
  error: unknown,
) {
  const cause =
    error instanceof Error && "cause" in error ? error.cause : undefined;
  if (
    error instanceof SyntaxError ||
    cause instanceof SyntaxError ||
    (error instanceof Error && /json/i.test(error.message))
  ) {
    return c.json(
      errorResponse("INVALID_JSON", "Request body is not JSON"),
      400,
    );
  }
  if (error instanceof TodoNotFoundError) {
    return c.json(errorResponse("TODO_NOT_FOUND", "Todo not found"), 404);
  }
  if (error instanceof TodoConflictError) {
    return c.json(errorResponse("TODO_CONFLICT", "Todo already exists"), 409);
  }
  console.error(JSON.stringify({ level: "error", message: "request failed" }));
  return c.json(errorResponse("INTERNAL_ERROR", "Internal server error"), 500);
}

export function createApp(dependencies: AppDependencies) {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (result.success) {
        return;
      }
      const code =
        result.error.issues.some((issue) => issue.path[0] === "body") &&
        result.error.issues.some((issue) => issue.code === "invalid_type")
          ? "INVALID_JSON"
          : "VALIDATION_ERROR";
      return c.json(
        errorResponse(code, "Request validation failed", result.error.issues),
        400,
      );
    },
  });

  app.use("*", async (c, next) => {
    const startedAt = performance.now();
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    c.header("x-request-id", requestId);
    await next();
    console.log(
      JSON.stringify({
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      }),
    );
  });

  app.openapi(healthRoute, (c) =>
    c.json(
      { data: { status: "ok" as const, color: dependencies.color ?? "blue" } },
      200,
    ),
  );
  app.openapi(listTodosRoute, async (c) =>
    c.json({ data: await dependencies.todoService.list() }, 200),
  );
  app.openapi(getTodoRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json({ data: await dependencies.todoService.get(id) }, 200);
  });
  app.openapi(createTodoRoute, async (c) =>
    c.json(
      { data: await dependencies.todoService.create(c.req.valid("json")) },
      201,
    ),
  );
  app.openapi(updateTodoRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(
      {
        data: await dependencies.todoService.update(id, c.req.valid("json")),
      },
      200,
    );
  });
  app.openapi(deleteTodoRoute, async (c) => {
    const { id } = c.req.valid("param");
    await dependencies.todoService.delete(id);
    return c.body(null, 204);
  });
  app.notFound((c) =>
    c.json(errorResponse("TODO_NOT_FOUND", "Route not found"), 404),
  );
  app.onError((error, c) => jsonError(c, error));

  return app;
}

export function createDefaultApp() {
  const tableName = process.env.TODO_TABLE_NAME;
  if (!tableName) {
    throw new Error("TODO_TABLE_NAME is required");
  }
  const color = (process.env.APP_COLOR ?? "blue") as "blue" | "green";
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return createApp({
    todoService: new TodoService(new DynamoTodoRepository(client, tableName)),
    color,
  });
}

export type AppType = ReturnType<typeof createApp>;
