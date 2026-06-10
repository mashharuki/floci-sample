# Suggested Commands

Run these commands from the `cdk/` directory unless noted otherwise.

## Setup

```bash
bun install
docker compose up -d
bun run floci:setup
```

## Floci Lifecycle

```bash
bun run floci:up
bun run floci:down
docker compose ps
curl -f http://localhost:4566/_floci/health
```

## CDK Against Floci

```bash
bun run floci:cdk:bootstrap
bun run floci:cdk:synth
bun run floci:cdk:deploy
bun run floci:cdk:destroy
```

Use the `floci:cdk:*` scripts for local work because they set dummy credentials,
the local endpoint, account, and region.

## Validation

```bash
bun run format
bun run build
bun run test
bun run synth
```

## Direct AWS CLI Checks

```bash
aws --endpoint-url http://localhost:4566 --region us-east-1 s3 ls
aws --endpoint-url http://localhost:4566 --region us-east-1 sqs list-queues
```

## Repository Inspection

```bash
git status --short --branch
rg --files
rg "pattern" cdk
```

## Known Command Issue

Do not rely on `bun run diff` until `ckd diff` in `cdk/package.json` is corrected.
Use `bunx cdk diff` or `npx cdk diff` instead.
