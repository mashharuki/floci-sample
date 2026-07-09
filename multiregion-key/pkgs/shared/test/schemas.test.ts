import { expect, test } from "vitest";
import {
  SignRequestSchema,
  VerifyRequestSchema,
  errorResponse,
} from "../src/index.js";

test("sign and verify schemas accept canonical base64 payloads", () => {
  const message = "aGVsbG8=";
  const signature = "c2lnbmF0dXJl";

  expect(SignRequestSchema.parse({ region: "tokyo", message })).toEqual({
    region: "tokyo",
    message,
  });
  expect(
    VerifyRequestSchema.parse({ region: "osaka", message, signature }),
  ).toEqual({ region: "osaka", message, signature });
});

test("errorResponse omits undefined details", () => {
  expect(errorResponse("KEY_SET_NOT_FOUND", "missing")).toEqual({
    error: { code: "KEY_SET_NOT_FOUND", message: "missing" },
  });
});
