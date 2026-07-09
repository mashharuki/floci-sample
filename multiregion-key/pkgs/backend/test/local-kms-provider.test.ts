import { expect, test } from "vitest";
import { LocalKmsProvider } from "../src/providers/local-kms-provider.js";

test("LocalKmsProvider signs and verifies the same material across regions", async () => {
  const provider = new LocalKmsProvider();
  const keySet = {
    keySetId: "00000000-0000-4000-8000-000000000000",
    alias: "alias/mrk-sample/local",
    status: "ACTIVE" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...(await provider.createKeySet({
      keySetId: "00000000-0000-4000-8000-000000000000",
      alias: "alias/mrk-sample/local",
      now: new Date().toISOString(),
    })),
  };
  const message = Buffer.from("provider test");
  const signature = await provider.sign({
    keySet,
    region: "tokyo",
    message,
  });
  await expect(
    provider.verify({ keySet, region: "osaka", message, signature }),
  ).resolves.toBe(true);
});
