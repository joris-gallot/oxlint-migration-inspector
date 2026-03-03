import { relative } from 'pathe'

export function buildProjectCommands(configPath: string, basePath: string) {
  const relativeConfigPath = relative(basePath, configPath) || 'eslint.config.js'
  const cdCommand = `cd ${shellQuote(basePath)}`

  return {
    migrateDefault: `${cdCommand} && npx @oxlint/migrate ${shellQuote(relativeConfigPath)}`,
    migrateMax: `${cdCommand} && npx @oxlint/migrate ${shellQuote(relativeConfigPath)} --with-nursery --type-aware --js-plugins=true`,
    runOxlintShadow: `${cdCommand} && npx oxlint . --config .oxlintrc.json`,
  }
}

function shellQuote(value: string) {
  return `'${value.replaceAll('\'', '\'"\'"\'')}'`
}
