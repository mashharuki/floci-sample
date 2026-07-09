import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import {
  ApiErrorSchema,
  HealthResponseSchema,
  errorResponse,
} from "@multiregion-key/shared";
import { AwsKmsProvider } from "./providers/aws-kms-provider.js";
import type { KeyProvider } from "./providers/key-provider.js";
import { LocalKmsProvider } from "./providers/local-kms-provider.js";
import {
  DynamoKeySetRepository,
  type KeySetRepository,
} from "./repositories/key-set-repository.js";
import {
  createKeySetRoute,
  deleteKeySetRoute,
  getKeySetRoute,
  listKeySetsRoute,
  signRoute,
  verifyRoute,
} from "./routes/key-sets.js";
import {
  KeySetNotFoundError,
  KeySetPendingDeletionError,
  KmsKeyService,
} from "./services/kms-key-service.js";

export interface AppDependencies {
  keyService: KmsKeyService;
  apiKeyCheck?: {
    enabled: boolean;
    value?: string;
  };
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
  if (error instanceof KeySetNotFoundError) {
    return c.json(errorResponse("KEY_SET_NOT_FOUND", "Key set not found"), 404);
  }
  if (error instanceof KeySetPendingDeletionError) {
    return c.json(
      errorResponse("KEY_SET_PENDING_DELETION", "Key set is pending deletion"),
      409,
    );
  }
  console.error(
    JSON.stringify({
      level: "error",
      message: error instanceof Error ? error.message : "request failed",
    }),
  );
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
    if (
      dependencies.apiKeyCheck?.enabled &&
      c.req.path !== "/api/health" &&
      c.req.header("x-api-key") !== dependencies.apiKeyCheck.value
    ) {
      return c.json(errorResponse("VALIDATION_ERROR", "Invalid API key"), 403);
    }
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
    c.json({ data: { status: "ok" as const } }, 200),
  );
  app.openapi(listKeySetsRoute, async (c) =>
    c.json({ data: await dependencies.keyService.list() }, 200),
  );
  app.openapi(getKeySetRoute, async (c) => {
    const { keySetId } = c.req.valid("param");
    return c.json({ data: await dependencies.keyService.get(keySetId) }, 200);
  });
  app.openapi(createKeySetRoute, async (c) =>
    c.json(
      { data: await dependencies.keyService.create(c.req.valid("json")) },
      201,
    ),
  );
  app.openapi(deleteKeySetRoute, async (c) => {
    const { keySetId } = c.req.valid("param");
    return c.json(
      { data: await dependencies.keyService.scheduleDeletion(keySetId) },
      200,
    );
  });
  app.openapi(signRoute, async (c) => {
    const { keySetId } = c.req.valid("param");
    return c.json(
      {
        data: await dependencies.keyService.sign(keySetId, c.req.valid("json")),
      },
      200,
    );
  });
  app.openapi(verifyRoute, async (c) => {
    const { keySetId } = c.req.valid("param");
    return c.json(
      {
        data: await dependencies.keyService.verify(
          keySetId,
          c.req.valid("json"),
        ),
      },
      200,
    );
  });
  app.notFound((c) =>
    c.json(errorResponse("KEY_SET_NOT_FOUND", "Route not found"), 404),
  );
  app.onError((error, c) => jsonError(c, error));

  return app;
}

export function createDefaultApp() {
  const tableName = process.env.KEY_SETS_TABLE_NAME;
  if (!tableName) {
    throw new Error("KEY_SETS_TABLE_NAME is required");
  }
  const primaryRegion = process.env.PRIMARY_AWS_REGION ?? "ap-northeast-1";
  const replicaRegion = process.env.REPLICA_AWS_REGION ?? "ap-northeast-3";
  const repository: KeySetRepository = new DynamoKeySetRepository(
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
    tableName,
  );
  const provider: KeyProvider =
    process.env.KMS_PROVIDER === "aws"
      ? new AwsKmsProvider(primaryRegion, replicaRegion)
      : new LocalKmsProvider(primaryRegion, replicaRegion);
  return createApp({
    keyService: new KmsKeyService(repository, provider),
    apiKeyCheck: {
      enabled:
        process.env.API_KEY_CHECK_DISABLED !== "true" &&
        process.env.API_KEY_VALUE !== undefined,
      value: process.env.API_KEY_VALUE,
    },
  });
}

export type AppType = ReturnType<typeof createApp>;
