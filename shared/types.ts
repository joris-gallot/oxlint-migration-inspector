import type { RuleMetaData } from '@typescript-eslint/utils/ts-eslint'
import type { Linter } from 'eslint'

export interface FlatConfigItem extends Linter.Config {
  index: number
}

export type RuleLevel = 'off' | 'warn' | 'error'

export interface Payload {
  configs: FlatConfigItem[]
  rules: Record<string, RuleInfo>
  meta: PayloadMeta
  files?: MatchedFile[]
}

export interface ResolvedPayload extends Payload {
  configsIgnoreOnly: FlatConfigItem[]
  configsGeneral: FlatConfigItem[]

  ruleToState: Map<string, RuleConfigStates>
  globToConfigs: Map<string, FlatConfigItem[]>

  /**
   * Resolved data from files
   * Undefined if users disabled glob matching
   */
  filesResolved?: {
    list: string[]
    globToFiles: Map<string, Set<string>>
    configToFiles: Map<number, Set<string>>
    fileToGlobs: Map<string, Set<string>>
    fileToConfigs: Map<string, FlatConfigItem[]>
    groups: FilesGroup[]
  }
}

export interface MatchedFile {
  /**
   * Filepath
   */
  filepath: string
  /**
   * Matched globs, includes both positive and negative globs
   */
  globs: string[]
  /**
   * Matched configs indexes
   */
  configs: number[]
}

export interface ErrorInfo {
  error: string
  message?: string
}

export interface FilesGroup {
  id: string
  files: string[]
  configs: FlatConfigItem[]
  globs: Set<string>
}

export interface PayloadMeta {
  wsPort?: number
  lastUpdate: number
  basePath: string
  configPath: string
}

export interface RuleInfo extends RuleMetaData<any, any> {
  name: string
  plugin: string
  /**
   * The rule may be removed
   */
  invalid?: boolean
}

export interface FiltersConfigsPage {
  rule?: string
  filepath?: string
}

export interface RuleConfigState {
  name: string
  configIndex: number
  level: RuleLevel
  options?: any[]
}

export type RuleConfigStates = RuleConfigState[]

export type MigrationScenario = 'native' | 'default' | 'max'

export type RuleSupportStatus
  = | 'native_default'
    | 'via_js_plugins'
    | 'requires_nursery'
    | 'requires_type_aware'
    | 'not_implemented'
    | 'unsupported'
    | 'off_only'

export interface AnalyzeWorkspaceOptions {
  root: string
  include?: string[]
  exclude?: string[]
  basePath?: string
  globMatchedFiles?: boolean
}

export interface SkippedByCategory {
  nursery: string[]
  typeAware: string[]
  jsPlugins: string[]
  notImplemented: string[]
  unsupported: string[]
}

export interface ProjectRuleReport {
  name: string
  status: RuleSupportStatus
  eslintLevels: RuleLevel[]
  configIndexes: number[]
  reason?: string
}

export interface MigratedScenarioConfig {
  format: 'json'
  code: string
}

export interface MigratedConfigsByScenario {
  native: MigratedScenarioConfig
  default: MigratedScenarioConfig
  max: MigratedScenarioConfig
}

export interface ProjectReport {
  id: string
  name: string
  configPath: string
  basePath: string
  warnings: string[]
  payload: Payload
  stats: {
    eslintActiveRules: number
    coverageNativePct: number
    coverageDefaultPct: number
    coverageMaxPct: number
    notImplemented: number
    unsupported: number
  }
  skippedByCategory: SkippedByCategory
  rules: ProjectRuleReport[]
  migratedConfigs: MigratedConfigsByScenario
  commandPreview: {
    migrateNative: string
    migrateDefault: string
    migrateMax: string
    runOxlintShadow: string
  }
  dependencies: string[]
}

export interface WorkspaceReport {
  generatedAt: number
  root: string
  projects: ProjectReport[]
  totals: {
    projectCount: number
    eslintActiveRules: number
    coverageDefaultPct: number
    coverageMaxPct: number
  }
}

export interface WorkspacePayload {
  workspace: WorkspaceReport
}
