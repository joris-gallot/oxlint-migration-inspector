<img src="./public/favicon.svg" width="100" height="100"><br>

# Oxlint Migration Inspector
A visual tool to migrate incrementally from ESLint flat config to Oxlint.

## Attribution

This project is a fork of [eslint config-inspector](https://github.com/eslint/config-inspector) and remains distributed under the Apache-2.0 license.

## What It Does

- Discovers `eslint.config.{js,mjs,cjs,ts,mts,cts}` across a workspace
- Computes migration coverage with three scenarios:
  - `native` (`jsPlugins=false`, `withNursery=false`, `typeAware=false`)
  - `default` (`jsPlugins=true`, `withNursery=false`, `typeAware=false`)
  - `max` (`jsPlugins=true`, `withNursery=true`, `typeAware=true`)
- Classifies ESLint rules into migration statuses (`native_default`, `via_js_plugins`, `requires_nursery`, `requires_type_aware`, `not_implemented`, `unsupported`, `off_only`)
- Provides command previews for incremental migration (`@oxlint/migrate` + `oxlint`)

## Usage

Run from your workspace root:

```bash
npx oxlint-migration-inspector
```

Then open `http://localhost:7777`.

### Analyze from CLI (JSON/report)

```bash
npx oxlint-migration-inspector analyze --root . --json
npx oxlint-migration-inspector analyze --root . --output migration-report.json
```

### Static build

```bash
npx oxlint-migration-inspector build --root .
```

This generates a static app in `.oxlint-migration-inspector`.

## Incremental Migration Workflow

1. Keep ESLint as source of truth.
2. Use `default` coverage as your primary KPI.
3. Triage `unsupported` and `not_implemented` gaps first.
4. Use `--with-nursery` / `--type-aware` only where needed.
5. Re-run analysis and track coverage trend over time.

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
```

## License

[Apache-2.0](./LICENSE)
