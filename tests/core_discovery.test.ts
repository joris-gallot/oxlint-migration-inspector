import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { discoverConfigFiles } from '../src/core/discovery'

describe('discoverConfigFiles', () => {
  it('discovers flat config files and applies default excludes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'omi-discovery-'))

    try {
      await mkdir(join(root, 'packages', 'a'), { recursive: true })
      await mkdir(join(root, 'packages', 'b', 'dist'), { recursive: true })
      await mkdir(join(root, 'node_modules', 'x'), { recursive: true })

      await writeFile(join(root, 'packages', 'a', 'eslint.config.ts'), 'export default []\n')
      await writeFile(join(root, 'packages', 'b', 'eslint.config.js'), 'export default []\n')
      await writeFile(join(root, 'packages', 'b', 'dist', 'eslint.config.ts'), 'export default []\n')
      await writeFile(join(root, 'node_modules', 'x', 'eslint.config.ts'), 'export default []\n')

      const files = await discoverConfigFiles({ root })

      expect(files.length).toBe(2)
      expect(files.some(path => path.endsWith('/packages/a/eslint.config.ts'))).toBe(true)
      expect(files.some(path => path.endsWith('/packages/b/eslint.config.js'))).toBe(true)
      expect(files.some(path => path.includes('/dist/'))).toBe(false)
      expect(files.some(path => path.includes('/node_modules/'))).toBe(false)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('supports custom include and exclude patterns', async () => {
    const root = await mkdtemp(join(tmpdir(), 'omi-discovery-'))

    try {
      await mkdir(join(root, 'components', 'frontend'), { recursive: true })
      await mkdir(join(root, 'components', 'backend'), { recursive: true })

      await writeFile(join(root, 'components', 'frontend', 'eslint.config.ts'), 'export default []\n')
      await writeFile(join(root, 'components', 'backend', 'eslint.config.ts'), 'export default []\n')

      const files = await discoverConfigFiles({
        root,
        include: ['components/**/eslint.config.ts'],
        exclude: ['**/backend/**'],
      })

      expect(files.length).toBe(1)
      expect(files[0]?.endsWith('/components/frontend/eslint.config.ts')).toBe(true)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
