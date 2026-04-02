/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { defineConfig } from 'rolldown';
import { argv } from 'process';

const isProd = argv.includes('--prod');

// Get addon name from --addon=xxx argument
const addonArg = argv.find(e => e.startsWith('--addon='));
const addon = addonArg ? addonArg.replace(/^--addon=/, '') : null;

// Transform addon name to class name (e.g., "image" -> "ImageAddon")
function getAddonEntryPoint(addonName: string): string {
  let result = '';
  let nextCap = true;
  for (const char of addonName) {
    if (char === '-') {
      nextCap = true;
      continue;
    }
    result += nextCap ? char.toUpperCase() : char;
    nextCap = false;
  }
  result += 'Addon';
  return result;
}

const banner = `/**
 * Copyright (c) 2014-2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */`;

if (!addon) {
  console.error('Please specify addon name with --addon=<name>');
  process.exit(1);
}

const entryPoint = `addons/addon-${addon}/src/${getAddonEntryPoint(addon)}.ts`;

// ESM bundle for lib/
const bundleConfig = defineConfig({
  input: entryPoint,
  output: {
    file: `addons/addon-${addon}/lib/addon-${addon}.mjs`,
    format: 'esm',
    banner,
    minify: isProd,
    sourcemap: true,
  },
  treeshake: true,
  transform:{
    target:'es2021'
  },
  platform: addon === 'ligatures' ? 'node' : 'browser',
});

// CommonJS output for development/testing
const outConfig = defineConfig({
  input: `addons/addon-${addon}/src/**/*.ts`,
  output: {
    dir: `addons/addon-${addon}/out-esbuild/`,
    format: 'cjs',
    entryFileNames: '[name].js',
    preserveModules: false,
    minify: isProd,
    sourcemap: !isProd,
  },
  treeshake: true,
  transform:{
    target:'es2021'
  },
});

// Test output
const testConfig = addon === 'ligatures'
  ? null
  : defineConfig({
      input: `addons/addon-${addon}/test/**/*.ts`,
      output: {
        dir: `addons/addon-${addon}/out-esbuild-test/`,
        format: 'cjs',
        entryFileNames: '[name].js',
        preserveModules: false,
        minify: isProd,
        sourcemap: true,

      },
      treeshake: true,
      transform:{
        target:'es2021'
      },
    });

export default defineConfig(
  [bundleConfig, outConfig, ...(testConfig ? [testConfig] : [])]
);
