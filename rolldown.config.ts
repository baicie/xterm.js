/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { defineConfig } from 'rolldown';
import { argv } from 'process';

const isProd = argv.includes('--prod');
const isWatch = argv.includes('--watch');

const banner = `/**
 * Copyright (c) 2014-2024 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 * @license MIT
 *
 * Originally forked from (with the author's permission):
 *   Fabrice Bellard's javascript vt100 for jslinux:
 *   http://bellard.org/jslinux/
 *   Copyright (c) 2011 Fabrice Bellard
 */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/`;

// Common ESM build config for xterm.js core
const esmConfig = defineConfig({
  input: 'src/browser/public/Terminal.ts',
  output: {
    file: 'lib/xterm.mjs',
    format: 'esm',
    banner,
  },
  treeshake: true,
  minify: isProd,
  sourcemap: !isProd,
  target: 'es2021',
});

// CommonJS build config for testing (output to out-esbuild/)
const cjsConfig = defineConfig({
  input: {
    browser: 'src/browser/**/*.ts',
    common: 'src/common/**/*.ts',
    headless: 'src/headless/**/*.ts',
  },
  output: {
    dir: 'out-esbuild/',
    format: 'cjs',
    entryFileNames: '[name].js',
    preserveModules: false,
  },
  treeshake: true,
  minify: isProd,
  sourcemap: true,
  target: 'es2021',
});

// CommonJS test build config (output to out-esbuild-test/)
const testConfig = defineConfig({
  input: 'test/**/*.ts',
  output: {
    dir: 'out-esbuild-test/',
    format: 'cjs',
    entryFileNames: '[name].js',
    preserveModules: false,
  },
  treeshake: true,
  minify: isProd,
  sourcemap: true,
  target: 'es2021',
});

export default defineConfig([
  esmConfig,
  cjsConfig,
  testConfig,
]);
