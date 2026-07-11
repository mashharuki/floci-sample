#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { TodoBgAppStack } from "../lib/stacks/todo-bg-app-stack";
import { TodoBgDataStack } from "../lib/stacks/todo-bg-data-stack";
import { TodoBgRouterStack } from "../lib/stacks/todo-bg-router-stack";

const app = new cdk.App();

const target = app.node.tryGetContext("target") ?? "floci";
if (target !== "floci" && target !== "aws") {
  throw new Error("CDK context target must be 'floci' or 'aws'");
}

const active = app.node.tryGetContext("active") ?? "blue";
if (active !== "blue" && active !== "green") {
  throw new Error("CDK context active must be 'blue' or 'green'");
}

const env =
  target === "floci"
    ? { account: "000000000000", region: "us-east-1" }
    : { account: process.env.CDK_DEFAULT_ACCOUNT, region: "ap-northeast-1" };

const dataStack = new TodoBgDataStack(app, "TodoBgDataStack", { target, env });

const blueStack = new TodoBgAppStack(app, "TodoBgBlueStack", {
  color: "blue",
  table: dataStack.table,
  target,
  env,
});
blueStack.addDependency(dataStack);

const greenStack = new TodoBgAppStack(app, "TodoBgGreenStack", {
  color: "green",
  table: dataStack.table,
  target,
  env,
});
greenStack.addDependency(dataStack);

if (target === "aws") {
  const routerStack = new TodoBgRouterStack(app, "TodoBgRouterStack", {
    active,
    blueApi: blueStack.api,
    greenApi: greenStack.api,
    blueBucket: blueStack.bucket,
    greenBucket: greenStack.bucket,
    env,
  });
  routerStack.addDependency(blueStack);
  routerStack.addDependency(greenStack);
}
