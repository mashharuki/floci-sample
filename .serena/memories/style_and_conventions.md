# Style and Conventions

## Language

- Use TypeScript with strict typing.
- The project uses ES2022 and NodeNext module/module resolution.
- Prefer explicit AWS CDK L2 constructs from `aws-cdk-lib`.
- Keep stack definitions under `cdk/lib/` and application entry points under `cdk/bin/`.

## Formatting and Linting

- Biome is the formatter and linter.
- Use spaces for indentation.
- Use double quotes in JavaScript and TypeScript.
- Let Biome organize imports.
- Run `bun run format` before completing formatting-related changes.

## Code Style

- Follow the existing CDK construct pattern: import service modules, extend
  `cdk.Stack`, and create resources inside the constructor.
- Keep comments concise and useful. Existing source comments are partly Japanese;
  preserve the language used by the surrounding file.
- Avoid unrelated refactors in this learning repository.
- Use ASCII unless the surrounding file already uses Japanese or another non-ASCII
  character set.

## Tests

- Tests live in `cdk/test/` and use `*.test.ts`.
- Use Jest with `ts-jest`.
- Prefer CDK assertions against synthesized templates rather than empty placeholder
  tests.

## Local AWS Safety

- For local emulator operations, always provide the Floci endpoint or use the wrapper
  scripts.
- Never use real AWS credentials for Floci.
- Confirm endpoint, account, and region before deploy or destroy operations.
