#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { CdkStack } from "../lib/cdk-stack";

const app = new cdk.App();
const target = app.node.tryGetContext("target") ?? "floci";
if (target !== "floci" && target !== "aws") {
  throw new Error("CDK context target must be floci or aws");
}

new CdkStack(app, "CdkStack", {
  target,
  env:
    target === "floci"
      ? { account: "000000000000", region: "us-east-1" }
      : {
          account: process.env.CDK_DEFAULT_ACCOUNT,
          region: "ap-northeast-1",
        },
});
