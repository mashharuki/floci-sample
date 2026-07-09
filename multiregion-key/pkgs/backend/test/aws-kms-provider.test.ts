import {
  CreateAliasCommand,
  CreateKeyCommand,
  ReplicateKeyCommand,
  SignCommand,
  VerifyCommand,
} from "@aws-sdk/client-kms";
import { describe, expect, test } from "vitest";
import { AwsKmsProvider } from "../src/providers/aws-kms-provider.js";
import type { StoredKeySet } from "../src/repositories/key-set-repository.js";

function mockProvider() {
  const provider = new AwsKmsProvider("ap-northeast-1", "ap-northeast-3");
  const sent: Array<{ name: string; input: unknown }> = [];
  const primaryClient = {
    send: async (command: {
      constructor: { name: string };
      input: Record<string, unknown>;
    }) => {
      sent.push({ name: command.constructor.name, input: command.input });
      if (command instanceof CreateKeyCommand) {
        return {
          KeyMetadata: {
            KeyId: "primary-key",
            Arn: "arn:aws:kms:ap-northeast-1:123456789012:key/primary-key",
          },
        };
      }
      if (command instanceof ReplicateKeyCommand) {
        return {
          ReplicaKeyMetadata: {
            KeyId: "replica-key",
            Arn: "arn:aws:kms:ap-northeast-3:123456789012:key/replica-key",
          },
        };
      }
      if (command instanceof SignCommand) {
        return { Signature: new Uint8Array([1, 2, 3]) };
      }
      if (command instanceof VerifyCommand) {
        return { SignatureValid: true };
      }
      return {};
    },
  };
  const replicaClient = { send: primaryClient.send };
  Object.assign(provider as unknown as Record<string, unknown>, {
    primaryClient,
    replicaClient,
  });
  return { provider, sent };
}

describe("AwsKmsProvider", () => {
  test("creates primary, alias, replica, and replica alias with expected KMS inputs", async () => {
    const { provider, sent } = mockProvider();
    const result = await provider.createKeySet({
      keySetId: "00000000-0000-4000-8000-000000000000",
      alias: "alias/mrk-sample/test",
      now: new Date().toISOString(),
    });

    expect(result.primary.keyId).toBe("primary-key");
    expect(result.replica.keyId).toBe("replica-key");
    expect(sent.map((entry) => entry.name)).toEqual([
      "CreateKeyCommand",
      "CreateAliasCommand",
      "ReplicateKeyCommand",
      "CreateAliasCommand",
    ]);
    expect(sent[0]?.input).toMatchObject({
      MultiRegion: true,
      KeySpec: "ECC_NIST_P256",
      KeyUsage: "SIGN_VERIFY",
    });
    expect(sent[1]?.input).toEqual({
      AliasName: "alias/mrk-sample/test",
      TargetKeyId: "primary-key",
    });
    expect(sent[2]?.input).toMatchObject({
      KeyId: "primary-key",
      ReplicaRegion: "ap-northeast-3",
    });
    expect(sent[3]?.input).toEqual({
      AliasName: "alias/mrk-sample/test",
      TargetKeyId: "replica-key",
    });
  });

  test("uses the selected related key for sign and verify", async () => {
    const { provider, sent } = mockProvider();
    const keySet: StoredKeySet = {
      keySetId: "00000000-0000-4000-8000-000000000000",
      alias: "alias/mrk-sample/test",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      primary: {
        region: "tokyo",
        awsRegion: "ap-northeast-1",
        keyId: "primary-key",
        keyArn: "arn:aws:kms:ap-northeast-1:123456789012:key/primary-key",
        status: "ACTIVE",
      },
      replica: {
        region: "osaka",
        awsRegion: "ap-northeast-3",
        keyId: "replica-key",
        keyArn: "arn:aws:kms:ap-northeast-3:123456789012:key/replica-key",
        status: "ACTIVE",
      },
    };

    await provider.sign({
      keySet,
      region: "osaka",
      message: new Uint8Array([1]),
    });
    await provider.verify({
      keySet,
      region: "tokyo",
      message: new Uint8Array([1]),
      signature: new Uint8Array([2]),
    });

    expect(sent.at(-2)).toMatchObject({
      name: "SignCommand",
      input: { KeyId: "replica-key", SigningAlgorithm: "ECDSA_SHA_256" },
    });
    expect(sent.at(-1)).toMatchObject({
      name: "VerifyCommand",
      input: { KeyId: "primary-key", SigningAlgorithm: "ECDSA_SHA_256" },
    });
  });
});
