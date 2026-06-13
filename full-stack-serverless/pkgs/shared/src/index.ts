import { z } from "@hono/zod-openapi";

const trimmedString = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);

export const TodoSchema = z
  .object({
    id: z.uuid(),
    title: trimmedString(1, 100),
    description: trimmedString(0, 500).default(""),
    completed: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .openapi("Todo");

export const CreateTodoSchema = z
  .object({
    title: trimmedString(1, 100),
    description: trimmedString(0, 500).default(""),
  })
  .openapi("CreateTodo");

export const UpdateTodoSchema = z
  .object({
    title: trimmedString(1, 100).optional(),
    description: trimmedString(0, 500).optional(),
    completed: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  })
  .openapi("UpdateTodo");

export const TodoIdParamsSchema = z.object({
  id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
});

export const ErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "INVALID_JSON",
  "TODO_NOT_FOUND",
  "TODO_CONFLICT",
  "INTERNAL_ERROR",
]);

export const ApiErrorSchema = z
  .object({
    error: z.object({
      code: ErrorCodeSchema,
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .openapi("ApiError");

export const TodoResponseSchema = z
  .object({ data: TodoSchema })
  .openapi("TodoResponse");
export const TodoListResponseSchema = z
  .object({ data: z.array(TodoSchema) })
  .openapi("TodoListResponse");
export const HealthResponseSchema = z
  .object({ data: z.object({ status: z.literal("ok") }) })
  .openapi("HealthResponse");

export type Todo = z.infer<typeof TodoSchema>;
export type CreateTodoInput = z.input<typeof CreateTodoSchema>;
export type UpdateTodoInput = z.infer<typeof UpdateTodoSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown,
) {
  return {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
}
