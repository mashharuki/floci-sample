import { randomUUID } from "node:crypto";
import type {
  CreateKeySetInput,
  KeySet,
  RegionName,
  SignInput,
  VerifyInput,
} from "@multiregion-key/shared";
import type { KeyProvider } from "../providers/key-provider.js";
import type {
  KeySetRepository,
  StoredKeySet,
} from "../repositories/key-set-repository.js";

export class KeySetNotFoundError extends Error {}
export class KeySetPendingDeletionError extends Error {}

export class KmsKeyService {
  constructor(
    private readonly repository: KeySetRepository,
    private readonly provider: KeyProvider,
  ) {}

  async list() {
    const keySets = await this.repository.list();
    return keySets.map(toPublicKeySet);
  }

  async get(keySetId: string) {
    return toPublicKeySet(await this.mustGet(keySetId));
  }

  async create(input: CreateKeySetInput) {
    const keySetId = randomUUID();
    const now = new Date().toISOString();
    const alias = `alias/mrk-sample/${input.aliasName ?? keySetId}`;
    const created = await this.provider.createKeySet({ keySetId, alias, now });
    const keySet: StoredKeySet = {
      keySetId,
      alias,
      primary: created.primary,
      replica: created.replica,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      ...(created.localPrivateKeyPem
        ? { localPrivateKeyPem: created.localPrivateKeyPem }
        : {}),
      ...(created.localPublicKeyPem
        ? { localPublicKeyPem: created.localPublicKeyPem }
        : {}),
    };
    await this.repository.put(keySet);
    return toPublicKeySet(keySet);
  }

  async scheduleDeletion(keySetId: string) {
    const keySet = await this.mustGet(keySetId);
    if (keySet.status === "PENDING_DELETION") {
      const deletionDate =
        keySet.replica.deletionDate ??
        keySet.primary.deletionDate ??
        new Date().toISOString();
      return { keySetId, status: "PENDING_DELETION" as const, deletionDate };
    }

    const deletionDate = await this.provider.scheduleDeletion(keySet);
    const updated: StoredKeySet = {
      ...keySet,
      status: "PENDING_DELETION",
      primary: {
        ...keySet.primary,
        status: "PENDING_DELETION",
        deletionDate,
      },
      replica: {
        ...keySet.replica,
        status: "PENDING_DELETION",
        deletionDate,
      },
      updatedAt: new Date().toISOString(),
    };
    await this.repository.put(updated);
    return { keySetId, status: "PENDING_DELETION" as const, deletionDate };
  }

  async sign(keySetId: string, input: SignInput) {
    const keySet = await this.mustActive(keySetId);
    const signature = await this.provider.sign({
      keySet,
      region: input.region,
      message: Buffer.from(input.message, "base64"),
    });
    return {
      keySetId,
      region: input.region,
      keyId: keyIdForRegion(keySet, input.region),
      signingAlgorithm: "ECDSA_SHA_256" as const,
      signature: Buffer.from(signature).toString("base64"),
    };
  }

  async verify(keySetId: string, input: VerifyInput) {
    const keySet = await this.mustActive(keySetId);
    const valid = await this.provider.verify({
      keySet,
      region: input.region,
      message: Buffer.from(input.message, "base64"),
      signature: Buffer.from(input.signature, "base64"),
    });
    return {
      keySetId,
      region: input.region,
      keyId: keyIdForRegion(keySet, input.region),
      signingAlgorithm: "ECDSA_SHA_256" as const,
      valid,
    };
  }

  private async mustGet(keySetId: string) {
    const keySet = await this.repository.get(keySetId);
    if (!keySet) {
      throw new KeySetNotFoundError(`Key set not found: ${keySetId}`);
    }
    return keySet;
  }

  private async mustActive(keySetId: string) {
    const keySet = await this.mustGet(keySetId);
    if (keySet.status === "PENDING_DELETION") {
      throw new KeySetPendingDeletionError(
        `Key set is pending deletion: ${keySetId}`,
      );
    }
    return keySet;
  }
}

function keyIdForRegion(keySet: KeySet, region: RegionName) {
  return region === "tokyo" ? keySet.primary.keyId : keySet.replica.keyId;
}

function toPublicKeySet(keySet: StoredKeySet): KeySet {
  const {
    localPrivateKeyPem: _privateKey,
    localPublicKeyPem: _publicKey,
    ...rest
  } = keySet;
  return rest;
}
