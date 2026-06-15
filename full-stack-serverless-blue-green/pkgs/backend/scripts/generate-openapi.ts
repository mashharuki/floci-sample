import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { createApp } from "../src/app.js";
import type { TodoRepository } from "../src/repositories/todo-repository.js";
import { TodoService } from "../src/services/todo-service.js";

const repository: TodoRepository = {
  list: async () => [],
  get: async () => undefined,
  create: async (todo) => todo,
  update: async () => {
    throw new Error("not called");
  },
  delete: async () => undefined,
};

const app = createApp({ todoService: new TodoService(repository) });
const document = app.getOpenAPIDocument({
  openapi: "3.1.0",
  info: {
    title: "Blue/Green Serverless Todo API",
    version: "1.0.0",
  },
});
const output = resolve(import.meta.dirname, "../../../docs/openapi.yaml");
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(output, stringify(document), "utf8");
