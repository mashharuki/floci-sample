import { handle } from "hono/aws-lambda";
import { createDefaultApp } from "./app.js";

export const handler = handle(createDefaultApp());
