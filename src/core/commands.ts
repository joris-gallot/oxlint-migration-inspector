import { relative } from 'pathe'

export function buildProjectCommands(configPath: string, basePath: string) {
  const relativeConfigPath = relative(basePath, configPath) || 'eslint.config.js'

  return {
    migrateNative: `npx @oxlint/migrate ${shellQuote(relativeConfigPath)} --js-plugins=false --with-nursery=false --type-aware=false`,
    migrateDefault: `npx @oxlint/migrate ${shellQuote(relativeConfigPath)}`,
    migrateMax: `npx @oxlint/migrate ${shellQuote(relativeConfigPath)} --with-nursery --type-aware --js-plugins=true`,
    runOxlintShadow: `npx oxlint . --config .oxlintrc.json`,
  }
}

function shellQuote(value: string) {
  return `'${value.replaceAll('\'', '\'"\'"\'')}'`
}
