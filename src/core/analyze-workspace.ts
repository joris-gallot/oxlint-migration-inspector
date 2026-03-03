import type { AnalyzeWorkspaceOptions, Payload, WorkspaceReport } from '../../shared/types'
import { basename, dirname, normalize, resolve } from 'pathe'
import { readConfig } from '../configs'
import { classifyProject } from './classify'
import { buildProjectCommands } from './commands'
import { discoverConfigFiles, toProjectId, toProjectName } from './discovery'
import { runMigrationScenarios } from './migrate'

export async function analyzeWorkspace(options: AnalyzeWorkspaceOptions): Promise<WorkspaceReport> {
  const root = resolve(options.root)
  const configPaths = await discoverConfigFiles({ ...options, root })

  const projects: WorkspaceReport['projects'] = []
  let totalEslintActiveRules = 0
  let totalDefaultCoveredRules = 0
  let totalMaxCoveredRules = 0

  for (const configPath of configPaths) {
    try {
      const parsed = await readConfig({
        cwd: dirname(configPath),
        userConfigPath: configPath,
        chdir: false,
        globMatchedFiles: options.globMatchedFiles ?? true,
      })

      const scenarios = await runMigrationScenarios(parsed.configs)
      const classified = classifyProject(parsed.payload, scenarios)
      const warnings = uniqueSorted([
        ...scenarios.native.warnings,
        ...scenarios.default.warnings,
        ...scenarios.max.warnings,
      ])

      totalEslintActiveRules += classified.stats.eslintActiveRules
      totalDefaultCoveredRules += classified.counts.defaultCoveredActive
      totalMaxCoveredRules += classified.counts.maxCoveredActive

      projects.push({
        id: toProjectId(root, configPath),
        name: toProjectName(root, configPath),
        configPath,
        basePath: parsed.payload.meta.basePath,
        warnings,
        payload: parsed.payload,
        stats: classified.stats,
        skippedByCategory: classified.skippedByCategory,
        rules: classified.rules,
        commandPreview: buildProjectCommands(configPath, parsed.payload.meta.basePath),
        dependencies: uniqueSorted([configPath, ...parsed.dependencies]),
      })
    }
    catch (error) {
      const fallbackBasePath = dirname(configPath)
      const fallbackPayload: Payload = {
        configs: [],
        rules: {},
        meta: {
          lastUpdate: Date.now(),
          basePath: fallbackBasePath,
          configPath,
        },
      }

      projects.push({
        id: toProjectId(root, configPath),
        name: toProjectName(root, configPath),
        configPath,
        basePath: fallbackBasePath,
        warnings: [
          `Failed to analyze ${configPath}`,
          String(error),
        ],
        payload: fallbackPayload,
        stats: {
          eslintActiveRules: 0,
          coverageNativePct: 0,
          coverageDefaultPct: 0,
          coverageMaxPct: 0,
          notImplemented: 0,
          unsupported: 0,
        },
        skippedByCategory: {
          nursery: [],
          typeAware: [],
          jsPlugins: [],
          notImplemented: [],
          unsupported: [],
        },
        rules: [],
        commandPreview: buildProjectCommands(configPath, fallbackBasePath),
        dependencies: [configPath],
      })
    }
  }

  projects.sort((a, b) => a.name.localeCompare(b.name) || a.configPath.localeCompare(b.configPath))

  return {
    generatedAt: Date.now(),
    root: normalize(root),
    projects,
    totals: {
      projectCount: projects.length,
      eslintActiveRules: totalEslintActiveRules,
      coverageDefaultPct: toPercent(totalDefaultCoveredRules, totalEslintActiveRules),
      coverageMaxPct: toPercent(totalMaxCoveredRules, totalEslintActiveRules),
    },
  }
}

export function getDefaultWorkspaceRoot(cwd: string) {
  return resolve(cwd)
}

export function toOutputProjectName(configPath: string) {
  return basename(dirname(configPath)) || basename(configPath)
}

function toPercent(numerator: number, denominator: number) {
  if (denominator === 0)
    return 0
  return Math.round((numerator / denominator) * 10000) / 100
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
}
