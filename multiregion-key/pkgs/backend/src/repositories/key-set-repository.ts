import { ScanCommand } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import type { KeySet } from "@multiregion-key/shared";

export interface StoredKeySet extends KeySet {
  localPrivateKeyPem?: string;
  localPublicKeyPem?: string;
}

export interface KeySetRepository {
  list(): Promise<StoredKeySet[]>;
  get(keySetId: string): Promise<StoredKeySet | undefined>;
  put(keySet: StoredKeySet): Promise<void>;
  delete(keySetId: string): Promise<void>;
}

export class InMemoryKeySetRepository implements KeySetRepository {
  private readonly items = new Map<string, StoredKeySet>();

  async list() {
    return [...this.items.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async get(keySetId: string) {
    return this.items.get(keySetId);
  }

  async put(keySet: StoredKeySet) {
    this.items.set(keySet.keySetId, keySet);
  }

  async delete(keySetId: string) {
    this.items.delete(keySetId);
  }
}

export class DynamoKeySetRepository implements KeySetRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async list() {
    const result = await this.client.send(
      new ScanCommand({ TableName: this.tableName }),
    );
    return ((result.Items as StoredKeySet[] | undefined) ?? []).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async get(keySetId: string) {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { keySetId },
      }),
    );
    return result.Item as StoredKeySet | undefined;
  }

  async put(keySet: StoredKeySet) {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: keySet,
      }),
    );
  }

  async delete(keySetId: string) {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { keySetId },
      }),
    );
  }
}
