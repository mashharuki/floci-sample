import { describe, expect, test } from "vitest";
import { createApp } from "../src/app.js";
import { LocalKmsProvider } from "../src/providers/local-kms-provider.js";
import { InMemoryKeySetRepository } from "../src/repositories/key-set-repository.js";
import { KmsKeyService } from "../src/services/kms-key-service.js";

function testApp() {
  return createApp({
    keyService: new KmsKeyService(
      new InMemoryKeySetRepository(),
      new LocalKmsProvider(),
    ),
  });
}

async function json(response: Response) {
  return (await response.json()) as { data?: unknown; error?: unknown };
}

describe("multiregion-key API", () => {
  test("health returns ok", async () => {
    const response = await testApp().request("/api/health");
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ data: { status: "ok" } });
  });

  test("creates, lists, signs, cross-region verifies, and schedules deletion", async () => {
    const app = testApp();
    const createdResponse = await app.request("/api/key-sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aliasName: "integration" }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await json(createdResponse)).data as {
      keySetId: string;
      alias: string;
    };
    expect(created.alias).toBe("alias/mrk-sample/integration");

    const listResponse = await app.request("/api/key-sets");
    expect(listResponse.status).toBe(200);
    expect((await json(listResponse)).data).toHaveLength(1);

    const message = Buffer.from("hello multiregion key").toString("base64");
    const tokyoSignResponse = await app.request(
      `/api/key-sets/${created.keySetId}/sign`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region: "tokyo", message }),
      },
    );
    expect(tokyoSignResponse.status).toBe(200);
    const tokyoSignature = (
      (await json(tokyoSignResponse)).data as {
        signature: string;
      }
    ).signature;

    const osakaVerifyResponse = await app.request(
      `/api/key-sets/${created.keySetId}/verify`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          region: "osaka",
          message,
          signature: tokyoSignature,
        }),
      },
    );
    expect(osakaVerifyResponse.status).toBe(200);
    expect((await json(osakaVerifyResponse)).data).toMatchObject({
      region: "osaka",
      valid: true,
    });

    const osakaSignResponse = await app.request(
      `/api/key-sets/${created.keySetId}/sign`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region: "osaka", message }),
      },
    );
    const osakaSignature = (
      (await json(osakaSignResponse)).data as {
        signature: string;
      }
    ).signature;
    const tokyoVerifyResponse = await app.request(
      `/api/key-sets/${created.keySetId}/verify`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          region: "tokyo",
          message,
          signature: osakaSignature,
        }),
      },
    );
    expect((await json(tokyoVerifyResponse)).data).toMatchObject({
      region: "tokyo",
      valid: true,
    });

    const deleteResponse = await app.request(
      `/api/key-sets/${created.keySetId}`,
      { method: "DELETE" },
    );
    expect(deleteResponse.status).toBe(200);
    expect((await json(deleteResponse)).data).toMatchObject({
      status: "PENDING_DELETION",
    });

    const rejectedSignResponse = await app.request(
      `/api/key-sets/${created.keySetId}/sign`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region: "tokyo", message }),
      },
    );
    expect(rejectedSignResponse.status).toBe(409);
  });
});
