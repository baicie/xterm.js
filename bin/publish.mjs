/**
 * Publish script for @baicie/xterm
 * This script is designed to run in CI after a tag is pushed.
 *
 * Usage: node bin/publish.mjs <tag>
 *
 * Example: node bin/publish.mjs xterm@6.1.0
 */

import { publish } from '@baicie/release'
import { resolve } from 'node:path'

const rootDir = resolve(import.meta.dirname, '..')

publish({
  defaultPackage: '@baicie/xterm',
  getPkgDir: pkg => rootDir,
  provenance: true,
  packageManager: 'pnpm',
})
