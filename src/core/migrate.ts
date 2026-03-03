import type { FlatConfigItem, MigrationScenario, SkippedByCategory } from '../../shared/types'
import migrate from '@oxlint/migrate'

type OxlintOptions = Parameters<typeof migrate>[2]
type OxlintConfig = Awaited<ReturnType<typeof migrate>>

type ReporterSkippedCategory
  = | 'nursery'
    | 'type-aware'
    | 'not-implemented'
    | 'unsupported'
    | 'js-plugins'

type ReporterSkippedByCategory = Record<ReporterSkippedCategory, string[]>

interface ReporterLike {
  addWarning: (message: string) => void
  getWarnings: () => string[]
  markSkipped: (rule: string, category: ReporterSkippedCategory) => void
  removeSkipped: (rule: string, category: ReporterSkippedCategory) => void
  getSkippedRulesByCategory: () => ReporterSkippedByCategory
}

const SCENARIO_OPTIONS: Record<
  MigrationScenario,
  { jsPlugins: boolean, withNursery: boolean, typeAware: boolean }
> = {
  native: {
    jsPlugins: false,
    withNursery: false,
    typeAware: false,
  },
  default: {
    jsPlugins: true,
    withNursery: false,
    typeAware: false,
  },
  max: {
    jsPlugins: true,
    withNursery: true,
    typeAware: true,
  },
}

export interface MigrationScenarioResult {
  scenario: MigrationScenario
  config: OxlintConfig
  coveredRules: Set<string>
  skippedByCategory: SkippedByCategory
  warnings: string[]
}

class MigrationReporter implements ReporterLike {
  private readonly warnings = new Set<string>()

  private readonly skippedRules = new Map<ReporterSkippedCategory, Set<string>>(
    [
      ['nursery', new Set<string>()],
      ['type-aware', new Set<string>()],
      ['not-implemented', new Set<string>()],
      ['unsupported', new Set<string>()],
      ['js-plugins', new Set<string>()],
    ],
  )

  addWarning(message: string): void {
    this.warnings.add(message)
  }

  getWarnings(): string[] {
    return Array.from(this.warnings)
  }

  markSkipped(rule: string, category: ReporterSkippedCategory): void {
    this.skippedRules.get(category)?.add(rule)
  }

  removeSkipped(rule: string, category: ReporterSkippedCategory): void {
    this.skippedRules.get(category)?.delete(rule)
  }

  getSkippedRulesByCategory(): ReporterSkippedByCategory {
    const result: ReporterSkippedByCategory = {
      'nursery': [],
      'type-aware': [],
      'not-implemented': [],
      'js-plugins': [],
      'unsupported': [],
    }
    for (const [category, rules] of this.skippedRules) {
      result[category] = Array.from(rules)
    }
    return result
  }
}

export async function runMigrationScenarios(
  configs: FlatConfigItem[],
): Promise<Record<MigrationScenario, MigrationScenarioResult>> {
  const native = await runMigrationScenario('native', configs)
  const defaultScenario = await runMigrationScenario('default', configs)
  const max = await runMigrationScenario('max', configs)

  return {
    native,
    default: defaultScenario,
    max,
  }
}

async function runMigrationScenario(
  scenario: MigrationScenario,
  configs: FlatConfigItem[],
): Promise<MigrationScenarioResult> {
  const reporter = new MigrationReporter()
  const options: OxlintOptions = {
    reporter,
    merge: false,
    ...SCENARIO_OPTIONS[scenario],
  }

  const config = await migrate(configs, undefined, options)

  return {
    scenario,
    config,
    coveredRules: collectEnabledRules(config),
    skippedByCategory: normalizeSkipped(reporter.getSkippedRulesByCategory()),
    warnings: reporter.getWarnings().sort((a, b) => a.localeCompare(b)),
  }
}

function normalizeSkipped(
  skipped: ReporterSkippedByCategory,
): SkippedByCategory {
  return {
    nursery: skipped.nursery.slice().sort((a, b) => a.localeCompare(b)),
    typeAware: skipped['type-aware'].slice().sort((a, b) => a.localeCompare(b)),
    jsPlugins: skipped['js-plugins'].slice().sort((a, b) => a.localeCompare(b)),
    notImplemented: skipped['not-implemented']
      .slice()
      .sort((a, b) => a.localeCompare(b)),
    unsupported: skipped.unsupported.slice().sort((a, b) => a.localeCompare(b)),
  }
}

function collectEnabledRules(config: OxlintConfig): Set<string> {
  const rules = new Set<string>()

  for (const [ruleName, value] of Object.entries(config?.rules ?? {})) {
    if (!isOffValue(value))
      rules.add(ruleName)
  }

  for (const override of config?.overrides ?? []) {
    for (const [ruleName, value] of Object.entries(override?.rules ?? {})) {
      if (!isOffValue(value))
        rules.add(ruleName)
    }
  }

  return rules
}

function isOffValue(value: unknown) {
  const first = Array.isArray(value) ? value[0] : value
  return first === 0 || first === 'off'
}
