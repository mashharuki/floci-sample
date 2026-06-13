import {
  ApiErrorSchema,
  CreateTodoSchema,
  TodoIdParamsSchema,
  TodoListResponseSchema,
  TodoResponseSchema,
  UpdateTodoSchema,
} from "@full-stack-serverless/shared";
import { createRoute, type z } from "@hono/zod-openapi";

const json = (schema: z.ZodType, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

export const listTodosRoute = createRoute({
  method: "get",
  path: "/api/todos",
  responses: { 200: json(TodoListResponseSchema, "Todo list") },
});

export const getTodoRoute = createRoute({
  method: "get",
  path: "/api/todos/{id}",
  request: { params: TodoIdParamsSchema },
  responses: {
    200: json(TodoResponseSchema, "Todo"),
    404: json(ApiErrorSchema, "Todo not found"),
  },
});

export const createTodoRoute = createRoute({
  method: "post",
  path: "/api/todos",
  request: {
    body: {
      content: { "application/json": { schema: CreateTodoSchema } },
      required: true,
    },
  },
  responses: {
    201: json(TodoResponseSchema, "Created todo"),
    400: json(ApiErrorSchema, "Invalid request"),
    409: json(ApiErrorSchema, "Todo conflict"),
  },
});

export const updateTodoRoute = createRoute({
  method: "patch",
  path: "/api/todos/{id}",
  request: {
    params: TodoIdParamsSchema,
    body: {
      content: { "application/json": { schema: UpdateTodoSchema } },
      required: true,
    },
  },
  responses: {
    200: json(TodoResponseSchema, "Updated todo"),
    400: json(ApiErrorSchema, "Invalid request"),
    404: json(ApiErrorSchema, "Todo not found"),
  },
});

export const deleteTodoRoute = createRoute({
  method: "delete",
  path: "/api/todos/{id}",
  request: { params: TodoIdParamsSchema },
  responses: {
    204: { description: "Deleted" },
    404: json(ApiErrorSchema, "Todo not found"),
  },
});
