import type { AnalyzeWorkspaceOptions } from '../../shared/types'
import { basename, dirname, normalize, relative, resolve } from 'pathe'
import { glob } from 'tinyglobby'

const DEFAULT_INCLUDE = ['**/eslint.config.{js,mjs,cjs,ts,mts,cts}']
const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/coverage/**']

export function getDefaultConfigGlobs() {
  return DEFAULT_INCLUDE.slice()
}

export function getDefaultExcludedGlobs() {
  return DEFAULT_EXCLUDE.slice()
}

export async function discoverConfigFiles(options: AnalyzeWorkspaceOptions): Promise<string[]> {
  const root = resolve(options.root)
  const scanRoot = options.basePath ? resolve(root, options.basePath) : root
  const include = options.include?.length ? options.include : DEFAULT_INCLUDE
  const ignore = [...DEFAULT_EXCLUDE, ...(options.exclude ?? [])]

  const entries = await glob(include, {
    cwd: scanRoot,
    absolute: true,
    onlyFiles: true,
    ignore,
  })

  return Array.from(new Set(entries.map(i => normalize(i)))).sort((a, b) => a.localeCompare(b))
}

export function toProjectId(root: string, configPath: string): string {
  return relative(root, configPath).replaceAll('\\', '/')
}

export function toProjectName(root: string, configPath: string): string {
  const relativeConfigPath = relative(root, configPath).replaceAll('\\', '/')
  const configDirectory = dirname(relativeConfigPath)
  return configDirectory === '.' ? basename(root) : basename(configDirectory)
}
