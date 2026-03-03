import { describe, expect, it } from 'vitest'
import { serializeOxlintConfig } from '../src/core/migrate'

describe('serializeOxlintConfig', () => {
  it('serializes undefined config to pretty empty object JSON', () => {
    expect(serializeOxlintConfig(undefined)).toBe('{}')
  })

  it('serializes config with 2-space indentation', () => {
    const code = serializeOxlintConfig({
      rules: {
        'no-console': 'error',
      },
    })

    expect(code).toContain('\n  "rules":')
    expect(() => JSON.parse(code)).not.toThrow()
  })
})
