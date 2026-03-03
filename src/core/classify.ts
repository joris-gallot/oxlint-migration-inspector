import type {
  Payload,
  ProjectRuleReport,
  RuleLevel,
  RuleSupportStatus,
  SkippedByCategory,
} from '../../shared/types'
import type { MigrationScenarioResult } from './migrate'
import { getRuleLevel } from '../../shared/rules'

interface RuleStateSummary {
  levels: Set<RuleLevel>
  configIndexes: Set<number>
  isActive: boolean
}

export interface ClassifiedProject {
  rules: ProjectRuleReport[]
  skippedByCategory: SkippedByCategory
  stats: {
    eslintActiveRules: number
    coverageNativePct: number
    coverageDefaultPct: number
    coverageMaxPct: number
    notImplemented: number
    unsupported: number
  }
  counts: {
    nativeCoveredActive: number
    defaultCoveredActive: number
    maxCoveredActive: number
  }
}

const STATUS_PRIORITY: RuleSupportStatus[] = [
  'unsupported',
  'not_implemented',
  'requires_type_aware',
  'requires_nursery',
  'via_js_plugins',
  'native_default',
  'off_only',
]

export function classifyProject(
  payload: Payload,
  scenarios: Record<'native' | 'default' | 'max', MigrationScenarioResult>,
): ClassifiedProject {
  const ruleStates = collectRuleStates(payload)

  const nativeCovered = scenarios.native.coveredRules
  const defaultCovered = scenarios.default.coveredRules
  const maxCovered = scenarios.max.coveredRules

  const nativeJsPluginSet = new Set(scenarios.native.skippedByCategory.jsPlugins)
  const defaultNurserySet = new Set(scenarios.default.skippedByCategory.nursery)
  const defaultTypeAwareSet = new Set(scenarios.default.skippedByCategory.typeAware)
  const maxNotImplementedSet = new Set(scenarios.max.skippedByCategory.notImplemented)
  const maxUnsupportedSet = new Set(scenarios.max.skippedByCategory.unsupported)

  const activeRuleNames = Array.from(ruleStates.entries())
    .filter(([, state]) => state.isActive)
    .map(([name]) => name)

  const nativeCoveredActive = countCovered(activeRuleNames, nativeCovered)
  const defaultCoveredActive = countCovered(activeRuleNames, defaultCovered)
  const maxCoveredActive = countCovered(activeRuleNames, maxCovered)

  const mergedSkippedByCategory = mergeSkippedByCategory(scenarios)

  const rules: ProjectRuleReport[] = []
  for (const [ruleName, state] of ruleStates) {
    const status = getRuleStatus({
      ruleName,
      state,
      nativeCovered,
      defaultCovered,
      maxCovered,
      defaultNurserySet,
      defaultTypeAwareSet,
      maxNotImplementedSet,
      maxUnsupportedSet,
    })

    const reason = getReason({
      status,
      ruleName,
      nativeJsPluginSet,
      defaultNurserySet,
      defaultTypeAwareSet,
      maxNotImplementedSet,
      maxUnsupportedSet,
    })

    rules.push({
      name: ruleName,
      status,
      eslintLevels: toSortedLevels(state.levels),
      configIndexes: Array.from(state.configIndexes).sort((a, b) => a - b),
      ...(reason ? { reason } : {}),
    })
  }

  rules.sort((a, b) => {
    const byStatus = STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status)
    if (byStatus !== 0)
      return byStatus
    return a.name.localeCompare(b.name)
  })

  const eslintActiveRules = activeRuleNames.length
  const notImplemented = rules.filter(rule => rule.status === 'not_implemented').length
  const unsupported = rules.filter(rule => rule.status === 'unsupported').length

  return {
    rules,
    skippedByCategory: mergedSkippedByCategory,
    stats: {
      eslintActiveRules,
      coverageNativePct: toPercent(nativeCoveredActive, eslintActiveRules),
      coverageDefaultPct: toPercent(defaultCoveredActive, eslintActiveRules),
      coverageMaxPct: toPercent(maxCoveredActive, eslintActiveRules),
      notImplemented,
      unsupported,
    },
    counts: {
      nativeCoveredActive,
      defaultCoveredActive,
      maxCoveredActive,
    },
  }
}

function collectRuleStates(payload: Payload): Map<string, RuleStateSummary> {
  const state = new Map<string, RuleStateSummary>()

  payload.configs.forEach((config) => {
    for (const [ruleName, value] of Object.entries(config.rules ?? {})) {
      const level = getRuleLevel(value)
      const current = state.get(ruleName) ?? {
        levels: new Set<RuleLevel>(),
        configIndexes: new Set<number>(),
        isActive: false,
      }

      current.levels.add(level)
      current.configIndexes.add(config.index)
      if (level === 'warn' || level === 'error')
        current.isActive = true

      state.set(ruleName, current)
    }
  })

  return state
}

function countCovered(rules: string[], coveredSet: Set<string>) {
  let count = 0
  for (const rule of rules) {
    if (coveredSet.has(rule))
      count++
  }
  return count
}

function mergeSkippedByCategory(
  scenarios: Record<'native' | 'default' | 'max', MigrationScenarioResult>,
): SkippedByCategory {
  return {
    nursery: uniqueSorted(scenarios.default.skippedByCategory.nursery),
    typeAware: uniqueSorted(scenarios.default.skippedByCategory.typeAware),
    jsPlugins: uniqueSorted([
      ...scenarios.native.skippedByCategory.jsPlugins,
      ...scenarios.default.skippedByCategory.jsPlugins,
    ]),
    notImplemented: uniqueSorted([
      ...scenarios.default.skippedByCategory.notImplemented,
      ...scenarios.max.skippedByCategory.notImplemented,
    ]),
    unsupported: uniqueSorted([
      ...scenarios.default.skippedByCategory.unsupported,
      ...scenarios.max.skippedByCategory.unsupported,
    ]),
  }
}

function getRuleStatus({
  ruleName,
  state,
  nativeCovered,
  defaultCovered,
  maxCovered,
  defaultNurserySet,
  defaultTypeAwareSet,
  maxNotImplementedSet,
  maxUnsupportedSet,
}: {
  ruleName: string
  state: RuleStateSummary
  nativeCovered: Set<string>
  defaultCovered: Set<string>
  maxCovered: Set<string>
  defaultNurserySet: Set<string>
  defaultTypeAwareSet: Set<string>
  maxNotImplementedSet: Set<string>
  maxUnsupportedSet: Set<string>
}): RuleSupportStatus {
  if (!state.isActive)
    return 'off_only'

  if (nativeCovered.has(ruleName))
    return 'native_default'

  if (defaultCovered.has(ruleName))
    return 'via_js_plugins'

  if (maxCovered.has(ruleName)) {
    if (defaultNurserySet.has(ruleName))
      return 'requires_nursery'
    if (defaultTypeAwareSet.has(ruleName))
      return 'requires_type_aware'

    // Fallback when max enables a rule that default could not.
    return 'requires_type_aware'
  }

  if (maxUnsupportedSet.has(ruleName))
    return 'unsupported'

  if (maxNotImplementedSet.has(ruleName))
    return 'not_implemented'

  return 'not_implemented'
}

function getReason({
  status,
  ruleName,
  nativeJsPluginSet,
  defaultNurserySet,
  defaultTypeAwareSet,
  maxNotImplementedSet,
  maxUnsupportedSet,
}: {
  status: RuleSupportStatus
  ruleName: string
  nativeJsPluginSet: Set<string>
  defaultNurserySet: Set<string>
  defaultTypeAwareSet: Set<string>
  maxNotImplementedSet: Set<string>
  maxUnsupportedSet: Set<string>
}) {
  if (status === 'via_js_plugins' && nativeJsPluginSet.has(ruleName))
    return 'Covered via jsPlugins'
  if (status === 'requires_nursery' && defaultNurserySet.has(ruleName))
    return 'Requires --with-nursery'
  if (status === 'requires_type_aware' && defaultTypeAwareSet.has(ruleName))
    return 'Requires --type-aware'
  if (status === 'unsupported' && maxUnsupportedSet.has(ruleName))
    return 'Marked unsupported by @oxlint/migrate'
  if (status === 'not_implemented' && maxNotImplementedSet.has(ruleName))
    return 'Not implemented in oxlint'
  return undefined
}

function toSortedLevels(levels: Set<RuleLevel>): RuleLevel[] {
  const order: RuleLevel[] = ['error', 'warn', 'off']
  return order.filter(level => levels.has(level))
}

function toPercent(numerator: number, denominator: number) {
  if (denominator === 0)
    return 0
  return Math.round((numerator / denominator) * 10000) / 100
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
}
