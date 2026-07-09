import type { KeySetRegion, RegionName } from "@multiregion-key/shared";
import type { StoredKeySet } from "../repositories/key-set-repository.js";

export interface CreateKeySetProviderInput {
  keySetId: string;
  alias: string;
  now: string;
}

export interface CreateKeySetProviderOutput {
  primary: KeySetRegion;
  replica: KeySetRegion;
  localPrivateKeyPem?: string;
  localPublicKeyPem?: string;
}

export interface SignProviderInput {
  keySet: StoredKeySet;
  region: RegionName;
  message: Uint8Array;
}

export interface VerifyProviderInput extends SignProviderInput {
  signature: Uint8Array;
}

export interface KeyProvider {
  createKeySet(
    input: CreateKeySetProviderInput,
  ): Promise<CreateKeySetProviderOutput>;
  scheduleDeletion(keySet: StoredKeySet): Promise<string>;
  sign(input: SignProviderInput): Promise<Uint8Array>;
  verify(input: VerifyProviderInput): Promise<boolean>;
}

export function regionOf(keySet: StoredKeySet, region: RegionName) {
  return region === "tokyo" ? keySet.primary : keySet.replica;
}
