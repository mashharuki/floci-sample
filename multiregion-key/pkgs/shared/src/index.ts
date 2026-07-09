import { z } from "@hono/zod-openapi";

const base64String = z
  .string()
  .min(1)
  .regex(
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    "Must be a canonical base64 string",
  );

export const RegionSchema = z.enum(["tokyo", "osaka"]).openapi("Region");
export const KeyStatusSchema = z
  .enum(["ACTIVE", "PENDING_DELETION"])
  .openapi("KeyStatus");

export const KeySetRegionSchema = z
  .object({
    region: RegionSchema,
    awsRegion: z.string(),
    keyId: z.string(),
    keyArn: z.string(),
    status: KeyStatusSchema,
    deletionDate: z.iso.datetime({ offset: true }).optional(),
  })
  .openapi("KeySetRegion");

export const KeySetSchema = z
  .object({
    keySetId: z.uuid(),
    alias: z.string().startsWith("alias/mrk-sample/"),
    primary: KeySetRegionSchema,
    replica: KeySetRegionSchema,
    status: KeyStatusSchema,
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .openapi("KeySet");

export const CreateKeySetSchema = z
  .object({
    aliasName: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^[a-zA-Z0-9/_+=,.@-]+$/)
      .optional(),
  })
  .openapi("CreateKeySet");

export const KeySetIdParamsSchema = z.object({
  keySetId: z.uuid().openapi({ param: { name: "keySetId", in: "path" } }),
});

export const SignRequestSchema = z
  .object({
    region: RegionSchema,
    message: base64String.openapi({ format: "byte" }),
  })
  .openapi("SignRequest");

export const VerifyRequestSchema = z
  .object({
    region: RegionSchema,
    message: base64String.openapi({ format: "byte" }),
    signature: base64String.openapi({ format: "byte" }),
  })
  .openapi("VerifyRequest");

export const SignResultSchema = z
  .object({
    keySetId: z.uuid(),
    region: RegionSchema,
    keyId: z.string(),
    signingAlgorithm: z.literal("ECDSA_SHA_256"),
    signature: base64String.openapi({ format: "byte" }),
  })
  .openapi("SignResult");

export const VerifyResultSchema = z
  .object({
    keySetId: z.uuid(),
    region: RegionSchema,
    keyId: z.string(),
    signingAlgorithm: z.literal("ECDSA_SHA_256"),
    valid: z.boolean(),
  })
  .openapi("VerifyResult");

export const ScheduleDeletionResultSchema = z
  .object({
    keySetId: z.uuid(),
    status: z.literal("PENDING_DELETION"),
    deletionDate: z.iso.datetime({ offset: true }),
  })
  .openapi("ScheduleDeletionResult");

export const HealthResponseSchema = z
  .object({ data: z.object({ status: z.literal("ok") }) })
  .openapi("HealthResponse");
export const KeySetResponseSchema = z
  .object({ data: KeySetSchema })
  .openapi("KeySetResponse");
export const KeySetListResponseSchema = z
  .object({ data: z.array(KeySetSchema) })
  .openapi("KeySetListResponse");
export const SignResponseSchema = z
  .object({ data: SignResultSchema })
  .openapi("SignResponse");
export const VerifyResponseSchema = z
  .object({ data: VerifyResultSchema })
  .openapi("VerifyResponse");
export const ScheduleDeletionResponseSchema = z
  .object({ data: ScheduleDeletionResultSchema })
  .openapi("ScheduleDeletionResponse");

export const ErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "INVALID_JSON",
  "KEY_SET_NOT_FOUND",
  "KEY_SET_PENDING_DELETION",
  "KMS_PROVIDER_ERROR",
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

export type RegionName = z.infer<typeof RegionSchema>;
export type KeyStatus = z.infer<typeof KeyStatusSchema>;
export type KeySetRegion = z.infer<typeof KeySetRegionSchema>;
export type KeySet = z.infer<typeof KeySetSchema>;
export type CreateKeySetInput = z.infer<typeof CreateKeySetSchema>;
export type SignInput = z.infer<typeof SignRequestSchema>;
export type VerifyInput = z.infer<typeof VerifyRequestSchema>;
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
