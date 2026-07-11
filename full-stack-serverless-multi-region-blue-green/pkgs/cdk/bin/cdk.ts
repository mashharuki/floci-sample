#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import {
  type AppColor,
  deploymentRegions,
  isDeploymentRegionName,
} from "../lib/regions";
import { TodoBgAppStack } from "../lib/stacks/todo-bg-app-stack";
import { TodoBgDataStack } from "../lib/stacks/todo-bg-data-stack";
import { TodoBgRouterStack } from "../lib/stacks/todo-bg-router-stack";

const app = new cdk.App();
const target = app.node.tryGetContext("target") ?? "floci";
if (target !== "floci" && target !== "aws") {
  throw new Error("CDK context target must be 'floci' or 'aws'");
}

const activeColor = app.node.tryGetContext("activeColor") ?? "blue";
if (activeColor !== "blue" && activeColor !== "green") {
  throw new Error("CDK context activeColor must be 'blue' or 'green'");
}
const activeRegion = app.node.tryGetContext("activeRegion") ?? "tokyo";
if (!isDeploymentRegionName(activeRegion)) {
  throw new Error("CDK context activeRegion must be 'tokyo' or 'osaka'");
}
const globalTablePhase = app.node.tryGetContext("globalTablePhase") ?? "all";
if (globalTablePhase !== "primary" && globalTablePhase !== "all") {
  throw new Error("CDK context globalTablePhase must be 'primary' or 'all'");
}

const account =
  target === "floci" ? "000000000000" : process.env.CDK_DEFAULT_ACCOUNT;
const localEnv = { account, region: "us-east-1" };
const tokyoEnv = { account, region: deploymentRegions.tokyo };
const dataStack = new TodoBgDataStack(app, "TodoBgDataStack", {
  target,
  env: target === "floci" ? localEnv : tokyoEnv,
  replicaRegions:
    target === "aws" && globalTablePhase === "primary"
      ? [deploymentRegions.tokyo]
      : Object.values(deploymentRegions),
});

for (const [regionName, deploymentRegion] of Object.entries(
  deploymentRegions,
)) {
  for (const color of ["blue", "green"] as const) {
    const regionCapitalized = regionName[0].toUpperCase() + regionName.slice(1);
    const colorCapitalized = color[0].toUpperCase() + color.slice(1);
    const appStack = new TodoBgAppStack(
      app,
      `TodoBg${regionCapitalized}${colorCapitalized}Stack`,
      {
        color,
        deploymentRegion,
        tableName: dataStack.tableName,
        target,
        env:
          target === "floci" ? localEnv : { account, region: deploymentRegion },
      },
    );
    appStack.addDependency(dataStack);
  }
}

if (target === "aws") {
  const activeApiUrl =
    app.node.tryGetContext("activeApiUrl") ??
    "https://example.execute-api.ap-northeast-1.amazonaws.com/v1/";
  const activeBucketName =
    app.node.tryGetContext("activeBucketName") ?? "placeholder-bucket";
  new TodoBgRouterStack(app, "TodoBgRouterStack", {
    activeColor: activeColor as AppColor,
    activeRegion,
    activeDeploymentRegion: deploymentRegions[activeRegion],
    activeApiUrl,
    activeBucketName,
    env: tokyoEnv,
  });
}
