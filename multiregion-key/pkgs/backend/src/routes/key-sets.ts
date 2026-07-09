import { createRoute, type z } from "@hono/zod-openapi";
import {
  ApiErrorSchema,
  CreateKeySetSchema,
  KeySetIdParamsSchema,
  KeySetListResponseSchema,
  KeySetResponseSchema,
  ScheduleDeletionResponseSchema,
  SignRequestSchema,
  SignResponseSchema,
  VerifyRequestSchema,
  VerifyResponseSchema,
} from "@multiregion-key/shared";

const json = (schema: z.ZodType, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

export const listKeySetsRoute = createRoute({
  method: "get",
  path: "/api/key-sets",
  responses: { 200: json(KeySetListResponseSchema, "Key set list") },
});

export const getKeySetRoute = createRoute({
  method: "get",
  path: "/api/key-sets/{keySetId}",
  request: { params: KeySetIdParamsSchema },
  responses: {
    200: json(KeySetResponseSchema, "Key set"),
    404: json(ApiErrorSchema, "Key set not found"),
  },
});

export const createKeySetRoute = createRoute({
  method: "post",
  path: "/api/key-sets",
  request: {
    body: {
      content: { "application/json": { schema: CreateKeySetSchema } },
      required: true,
    },
  },
  responses: {
    201: json(KeySetResponseSchema, "Created key set"),
    400: json(ApiErrorSchema, "Invalid request"),
    500: json(ApiErrorSchema, "Provider error"),
  },
});

export const deleteKeySetRoute = createRoute({
  method: "delete",
  path: "/api/key-sets/{keySetId}",
  request: { params: KeySetIdParamsSchema },
  responses: {
    200: json(ScheduleDeletionResponseSchema, "Deletion scheduled"),
    404: json(ApiErrorSchema, "Key set not found"),
  },
});

export const signRoute = createRoute({
  method: "post",
  path: "/api/key-sets/{keySetId}/sign",
  request: {
    params: KeySetIdParamsSchema,
    body: {
      content: { "application/json": { schema: SignRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: json(SignResponseSchema, "Signature"),
    400: json(ApiErrorSchema, "Invalid request"),
    404: json(ApiErrorSchema, "Key set not found"),
    409: json(ApiErrorSchema, "Key set pending deletion"),
  },
});

export const verifyRoute = createRoute({
  method: "post",
  path: "/api/key-sets/{keySetId}/verify",
  request: {
    params: KeySetIdParamsSchema,
    body: {
      content: { "application/json": { schema: VerifyRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: json(VerifyResponseSchema, "Verification result"),
    400: json(ApiErrorSchema, "Invalid request"),
    404: json(ApiErrorSchema, "Key set not found"),
    409: json(ApiErrorSchema, "Key set pending deletion"),
  },
});
