import { describe, expect, it } from 'vitest'
import { buildProjectCommands } from '../src/core/commands'

describe('buildProjectCommands', () => {
  it('builds migration command previews for a project', () => {
    const commands = buildProjectCommands(
      '/workspace/components/frontend/eslint.config.ts',
      '/workspace/components/frontend',
    )

    expect(commands.migrateDefault).toContain('npx @oxlint/migrate')
    expect(commands.migrateDefault).toContain('\'eslint.config.ts\'')
    expect(commands.migrateMax).toContain('--with-nursery --type-aware --js-plugins=true')
    expect(commands.runOxlintShadow).toContain('npx oxlint . --config .oxlintrc.json')
  })
})
