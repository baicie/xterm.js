/**
 * Release script for @baicie/xterm
 * Usage: node bin/release.mjs [options]
 *
 * Options:
 *   --dry         Dry run mode (no actual changes)
 */

import { release } from '@baicie/release'
import { resolve } from 'node:path'

const rootDir = resolve(import.meta.dirname, '..')

release({
  repo: 'baicie',
  packages: ['xterm'],
  toTag: (pkg, version) => `${pkg}@${version}`,
  getPkgDir: pkg => rootDir,
  logChangelog: _pkg => {
    void _pkg
  },
  generateChangelog: (_pkg, _version) => {
    void _pkg
    void _version
  },
})
