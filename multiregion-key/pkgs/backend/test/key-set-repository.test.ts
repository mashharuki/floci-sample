import {
  type DynamoDBDocumentClient,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { describe, expect, test } from "vitest";
import { DynamoKeySetRepository } from "../src/repositories/key-set-repository.js";

function item(keySetId: string, createdAt: string) {
  return {
    keySetId,
    alias: `alias/mrk-sample/${keySetId}`,
    status: "ACTIVE" as const,
    createdAt,
    updatedAt: createdAt,
    primary: {
      region: "tokyo" as const,
      awsRegion: "ap-northeast-1",
      keyId: `${keySetId}-primary`,
      keyArn: `arn:aws:kms:ap-northeast-1:000000000000:key/${keySetId}-primary`,
      status: "ACTIVE" as const,
    },
    replica: {
      region: "osaka" as const,
      awsRegion: "ap-northeast-3",
      keyId: `${keySetId}-replica`,
      keyArn: `arn:aws:kms:ap-northeast-3:000000000000:key/${keySetId}-replica`,
      status: "ACTIVE" as const,
    },
  };
}

describe("DynamoKeySetRepository", () => {
  test("lists unmarshalled document items in newest-first order", async () => {
    const sent: unknown[] = [];
    const client = {
      send: async (command: unknown) => {
        sent.push(command);
        return {
          Items: [
            item("old", "2026-07-10T00:00:00.000Z"),
            item("new", "2026-07-10T01:00:00.000Z"),
          ],
        };
      },
    } as Pick<DynamoDBDocumentClient, "send"> as DynamoDBDocumentClient;

    const repository = new DynamoKeySetRepository(client, "MultiRegionKeySets");

    await expect(repository.list()).resolves.toMatchObject([
      { keySetId: "new" },
      { keySetId: "old" },
    ]);
    expect(sent[0]).toBeInstanceOf(ScanCommand);
  });
});
