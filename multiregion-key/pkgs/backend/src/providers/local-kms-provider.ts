import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";
import type {
  CreateKeySetProviderInput,
  CreateKeySetProviderOutput,
  KeyProvider,
  SignProviderInput,
  VerifyProviderInput,
} from "./key-provider.js";
import { regionOf } from "./key-provider.js";

export class LocalKmsProvider implements KeyProvider {
  constructor(
    private readonly primaryAwsRegion = "ap-northeast-1",
    private readonly replicaAwsRegion = "ap-northeast-3",
  ) {}

  async createKeySet(
    input: CreateKeySetProviderInput,
  ): Promise<CreateKeySetProviderOutput> {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const localPrivateKeyPem = privateKey.export({
      type: "pkcs8",
      format: "pem",
    }) as string;
    const localPublicKeyPem = publicKey.export({
      type: "spki",
      format: "pem",
    }) as string;
    const primaryKeyId = `local-${input.keySetId}-primary`;
    const replicaKeyId = `local-${input.keySetId}-replica`;

    return {
      primary: {
        region: "tokyo",
        awsRegion: this.primaryAwsRegion,
        keyId: primaryKeyId,
        keyArn: `arn:aws:kms:${this.primaryAwsRegion}:000000000000:key/${primaryKeyId}`,
        status: "ACTIVE",
      },
      replica: {
        region: "osaka",
        awsRegion: this.replicaAwsRegion,
        keyId: replicaKeyId,
        keyArn: `arn:aws:kms:${this.replicaAwsRegion}:000000000000:key/${replicaKeyId}`,
        status: "ACTIVE",
      },
      localPrivateKeyPem,
      localPublicKeyPem,
    };
  }

  async scheduleDeletion() {
    const deletionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return deletionDate.toISOString();
  }

  async sign(input: SignProviderInput) {
    if (!input.keySet.localPrivateKeyPem) {
      throw new Error("Local private key material is missing");
    }
    regionOf(input.keySet, input.region);
    return sign("sha256", input.message, {
      key: createPrivateKey(input.keySet.localPrivateKeyPem),
      dsaEncoding: "der",
    });
  }

  async verify(input: VerifyProviderInput) {
    if (!input.keySet.localPublicKeyPem) {
      throw new Error("Local public key material is missing");
    }
    regionOf(input.keySet, input.region);
    return verify(
      "sha256",
      input.message,
      {
        key: createPublicKey(input.keySet.localPublicKeyPem),
        dsaEncoding: "der",
      },
      input.signature,
    );
  }
}
