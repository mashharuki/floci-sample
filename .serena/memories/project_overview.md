# Project Overview

## Purpose

`floci-sample` is a learning and verification repository for running AWS-compatible
resources locally with the Floci emulator. The current implementation is an AWS CDK
TypeScript application that defines a sample SQS queue and deploys it to Floci.

## Architecture

- `cdk/bin/cdk.ts`: CDK application entry point.
- `cdk/lib/cdk-stack.ts`: `CdkStack`, currently containing one SQS queue with a
  300-second visibility timeout.
- `cdk/test/cdk.test.ts`: Jest test location; the current test is only a placeholder.
- `cdk/docker-compose.yml`: Runs `floci/floci:latest` on port `4566`.
- `cdk/scripts/floci-cdk.sh`: Redirects CDK and AWS SDK calls to Floci using dummy
  credentials, account `000000000000`, and region `us-east-1`.
- `cdk/scripts/setup-local-aws.sh`: Waits for the Floci health endpoint and is intended
  for local AWS resource setup.

## Technology Stack

- TypeScript 5.9 with strict compiler settings and NodeNext modules.
- AWS CDK v2 and Constructs v10.
- Bun lockfile/package workflow, while CDK execution uses `npx`.
- Jest 30 with `ts-jest`.
- Biome 1.9 for formatting and linting.
- Docker Compose for the Floci emulator.
- AWS CLI v2, `curl`, and `jq` are expected by local scripts.

## Current Scope

This is a small infrastructure-as-code learning project, not a production application.
There is no frontend, backend service, database, or CI workflow in the repository.

## Important Notes

- Run package commands from `cdk/`, not the repository root.
- The Floci CDK wrapper uses `us-east-1`, while `cdk/.env.example` currently says
  `ap-northeast-1`; use the wrapper values when following the scripted local flow.
- The `diff` package script currently contains `ckd diff`, which appears to be a typo.
- Existing worktree changes may be user work; do not revert or overwrite them.
