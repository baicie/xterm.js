import { release } from '@baicie/release'
import { resolve } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const rootDir = resolve(import.meta.dirname, '..')

release({
  repo: 'baicie',
  packages: ['xterm'],
  toTag: (pkg, version) => `${pkg}@${version}`,
  getPkgDir: pkg => rootDir,
  logChangelog: _pkg => {
    void _pkg
  },
  generateChangelog: (pkg, version) => {
    const changelogPath = `${rootDir}/CHANGELOG.md`
    const date = new Date().toISOString().split('T')[0]
    const header = `# Changelog\n\n## ${version} (${date})\n\n`
    let existing = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf-8') : ''
    writeFileSync(changelogPath, header + existing)
    void pkg
  },
})
