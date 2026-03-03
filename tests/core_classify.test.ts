import type { Payload } from '../shared/types'
import type { MigrationScenarioResult } from '../src/core/migrate'
import { describe, expect, it } from 'vitest'
import { classifyProject } from '../src/core/classify'

function createScenarioResult(
  scenario: 'native' | 'default' | 'max',
  coveredRules: string[],
  skippedByCategory: Partial<MigrationScenarioResult['skippedByCategory']> = {},
): MigrationScenarioResult {
  return {
    scenario,
    config: {},
    configJsonCode: '{}',
    coveredRules: new Set(coveredRules),
    skippedByCategory: {
      nursery: [],
      typeAware: [],
      jsPlugins: [],
      notImplemented: [],
      unsupported: [],
      ...skippedByCategory,
    },
    warnings: [],
  }
}

describe('classifyProject', () => {
  it('classifies migration statuses and computes coverage', () => {
    const payload: Payload = {
      configs: [
        {
          index: 0,
          rules: {
            'rule/native': 'error',
            'rule/js-plugin': 'warn',
            'rule/nursery': 'error',
            'rule/type-aware': 'error',
            'rule/not-implemented': 'error',
            'rule/unsupported': 'error',
            'rule/off-only': 'off',
          },
        },
      ],
      rules: {},
      meta: {
        lastUpdate: Date.now(),
        basePath: '/tmp',
        configPath: '/tmp/eslint.config.ts',
      },
    }

    const scenarios = {
      native: createScenarioResult('native', ['rule/native'], {
        jsPlugins: ['rule/js-plugin'],
      }),
      default: createScenarioResult('default', ['rule/native', 'rule/js-plugin'], {
        nursery: ['rule/nursery'],
        typeAware: ['rule/type-aware'],
      }),
      max: createScenarioResult('max', ['rule/native', 'rule/js-plugin', 'rule/nursery', 'rule/type-aware'], {
        notImplemented: ['rule/not-implemented'],
        unsupported: ['rule/unsupported'],
      }),
    }

    const result = classifyProject(payload, scenarios)

    expect(result.stats.eslintActiveRules).toBe(6)
    expect(result.stats.coverageNativePct).toBe(16.67)
    expect(result.stats.coverageDefaultPct).toBe(33.33)
    expect(result.stats.coverageMaxPct).toBe(66.67)
    expect(result.stats.notImplemented).toBe(1)
    expect(result.stats.unsupported).toBe(1)

    const ruleStatus = Object.fromEntries(result.rules.map(rule => [rule.name, rule.status]))
    expect(ruleStatus['rule/native']).toBe('native_default')
    expect(ruleStatus['rule/js-plugin']).toBe('via_js_plugins')
    expect(ruleStatus['rule/nursery']).toBe('requires_nursery')
    expect(ruleStatus['rule/type-aware']).toBe('requires_type_aware')
    expect(ruleStatus['rule/not-implemented']).toBe('not_implemented')
    expect(ruleStatus['rule/unsupported']).toBe('unsupported')
    expect(ruleStatus['rule/off-only']).toBe('off_only')
  })
})
