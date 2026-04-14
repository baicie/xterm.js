import { publish } from '@baicie/release'
import { resolve } from 'node:path'

const rootDir = resolve(import.meta.dirname, '..')

publish({
  defaultPackage: '@baicie/xterm',
  getPkgDir: pkg => rootDir,
  packageManager: 'pnpm',
})
