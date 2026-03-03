import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeWorkspace } from '../src/core/analyze-workspace'

describe('analyzeWorkspace', () => {
  it('analyzes a workspace and returns migration report', async () => {
    const root = await mkdtemp(join(tmpdir(), 'omi-analyze-'))

    try {
      await mkdir(join(root, 'frontend'), { recursive: true })
      await writeFile(
        join(root, 'frontend', 'eslint.config.js'),
        'export default [{ rules: { "no-console": "error", "no-alert": "off" } }]\n',
      )

      const report = await analyzeWorkspace({
        root,
        globMatchedFiles: false,
      })

      expect(report.totals.projectCount).toBe(1)
      expect(report.projects.length).toBe(1)
      expect(report.projects[0]?.name).toBe('frontend')
      expect(report.projects[0]?.stats.eslintActiveRules).toBeGreaterThanOrEqual(1)
      expect(report.projects[0]?.rules.some(rule => rule.name === 'no-console')).toBe(true)
      expect(report.projects[0]?.commandPreview.migrateNative).toContain('--js-plugins=false --with-nursery=false --type-aware=false')
      expect(report.projects[0]?.commandPreview.migrateDefault).toContain('@oxlint/migrate')
      expect(report.projects[0]?.migratedConfigs.native.format).toBe('json')
      expect(() => JSON.parse(report.projects[0]?.migratedConfigs.native.code ?? '')).not.toThrow()
      expect(() => JSON.parse(report.projects[0]?.migratedConfigs.default.code ?? '')).not.toThrow()
      expect(() => JSON.parse(report.projects[0]?.migratedConfigs.max.code ?? '')).not.toThrow()
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
