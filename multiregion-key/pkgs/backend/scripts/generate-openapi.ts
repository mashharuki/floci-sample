import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { createApp } from "../src/app.js";
import { LocalKmsProvider } from "../src/providers/local-kms-provider.js";
import { InMemoryKeySetRepository } from "../src/repositories/key-set-repository.js";
import { KmsKeyService } from "../src/services/kms-key-service.js";

const app = createApp({
  keyService: new KmsKeyService(
    new InMemoryKeySetRepository(),
    new LocalKmsProvider(),
  ),
});
const document = app.getOpenAPIDocument({
  openapi: "3.1.0",
  info: {
    title: "Multi-Region KMS Key API",
    version: "1.0.0",
  },
});
const output = resolve(import.meta.dirname, "../../../docs/openapi.yaml");
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(output, stringify(document), "utf8");
