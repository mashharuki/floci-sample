import {
  CreateAliasCommand,
  CreateKeyCommand,
  KMSClient,
  type KeyMetadata,
  ReplicateKeyCommand,
  ScheduleKeyDeletionCommand,
  SignCommand,
  VerifyCommand,
} from "@aws-sdk/client-kms";
import type {
  CreateKeySetProviderInput,
  CreateKeySetProviderOutput,
  KeyProvider,
  SignProviderInput,
  VerifyProviderInput,
} from "./key-provider.js";
import { regionOf } from "./key-provider.js";

function requireMetadata(
  metadata: KeyMetadata | undefined,
  region: string,
): KeyMetadata & { Arn: string; KeyId: string } {
  if (!metadata?.KeyId || !metadata.Arn) {
    throw new Error(`KMS did not return key metadata for ${region}`);
  }
  return { ...metadata, Arn: metadata.Arn, KeyId: metadata.KeyId };
}

export class AwsKmsProvider implements KeyProvider {
  private readonly primaryClient: KMSClient;
  private readonly replicaClient: KMSClient;

  constructor(
    private readonly primaryAwsRegion = "ap-northeast-1",
    private readonly replicaAwsRegion = "ap-northeast-3",
  ) {
    this.primaryClient = new KMSClient({ region: primaryAwsRegion });
    this.replicaClient = new KMSClient({ region: replicaAwsRegion });
  }

  async createKeySet(
    input: CreateKeySetProviderInput,
  ): Promise<CreateKeySetProviderOutput> {
    const primary = await this.primaryClient.send(
      new CreateKeyCommand({
        Description: `multiregion-key ${input.keySetId}`,
        MultiRegion: true,
        KeySpec: "ECC_NIST_P256",
        KeyUsage: "SIGN_VERIFY",
        Tags: [
          { TagKey: "App", TagValue: "multiregion-key" },
          { TagKey: "KeySetId", TagValue: input.keySetId },
        ],
      }),
    );
    const primaryMetadata = requireMetadata(
      primary.KeyMetadata,
      this.primaryAwsRegion,
    );
    await this.primaryClient.send(
      new CreateAliasCommand({
        AliasName: input.alias,
        TargetKeyId: primaryMetadata.KeyId,
      }),
    );

    const replica = await this.primaryClient.send(
      new ReplicateKeyCommand({
        KeyId: primaryMetadata.KeyId,
        ReplicaRegion: this.replicaAwsRegion,
        Description: `multiregion-key ${input.keySetId} replica`,
        Tags: [
          { TagKey: "App", TagValue: "multiregion-key" },
          { TagKey: "KeySetId", TagValue: input.keySetId },
        ],
      }),
    );
    const replicaMetadata = requireMetadata(
      replica.ReplicaKeyMetadata,
      this.replicaAwsRegion,
    );
    await this.replicaClient.send(
      new CreateAliasCommand({
        AliasName: input.alias,
        TargetKeyId: replicaMetadata.KeyId,
      }),
    );

    return {
      primary: {
        region: "tokyo",
        awsRegion: this.primaryAwsRegion,
        keyId: primaryMetadata.KeyId,
        keyArn: primaryMetadata.Arn,
        status: "ACTIVE",
      },
      replica: {
        region: "osaka",
        awsRegion: this.replicaAwsRegion,
        keyId: replicaMetadata.KeyId,
        keyArn: replicaMetadata.Arn,
        status: "ACTIVE",
      },
    };
  }

  async scheduleDeletion(keySet: SignProviderInput["keySet"]) {
    const replica = await this.replicaClient.send(
      new ScheduleKeyDeletionCommand({
        KeyId: keySet.replica.keyId,
        PendingWindowInDays: 7,
      }),
    );
    await this.primaryClient.send(
      new ScheduleKeyDeletionCommand({
        KeyId: keySet.primary.keyId,
        PendingWindowInDays: 7,
      }),
    );
    return (replica.DeletionDate ?? new Date()).toISOString();
  }

  async sign(input: SignProviderInput) {
    const key = regionOf(input.keySet, input.region);
    const client =
      input.region === "tokyo" ? this.primaryClient : this.replicaClient;
    const result = await client.send(
      new SignCommand({
        KeyId: key.keyId,
        Message: input.message,
        MessageType: "RAW",
        SigningAlgorithm: "ECDSA_SHA_256",
      }),
    );
    if (!result.Signature) {
      throw new Error("KMS did not return a signature");
    }
    return result.Signature;
  }

  async verify(input: VerifyProviderInput) {
    const key = regionOf(input.keySet, input.region);
    const client =
      input.region === "tokyo" ? this.primaryClient : this.replicaClient;
    const result = await client.send(
      new VerifyCommand({
        KeyId: key.keyId,
        Message: input.message,
        MessageType: "RAW",
        Signature: input.signature,
        SigningAlgorithm: "ECDSA_SHA_256",
      }),
    );
    return result.SignatureValid === true;
  }
}
