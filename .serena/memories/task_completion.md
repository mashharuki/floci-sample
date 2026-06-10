# Task Completion Checklist

For code or configuration changes:

1. Review `git status --short --branch` and preserve unrelated user changes.
2. Run `bun run format` from `cdk/` when TypeScript or JSON formatting changed.
3. Run `bun run build`.
4. Run `bun run test`.
5. Run `bun run floci:cdk:synth` for CDK stack changes when Floci is available;
   otherwise run `bun run synth` and report any environment limitation.
6. For local deployment changes, verify Floci health before running deploy or destroy.
7. Summarize changed files and verification results.

For documentation-only or Serena-memory changes, validate the relevant files and
check Serena project health; a full CDK build is not required unless source behavior
was changed.
