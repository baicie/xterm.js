// @ts-check

import { argv } from 'process';
import path from 'path';
import { fileURLToPath } from 'url';
import { readdir, readFile } from 'fs/promises';
import { resolve, relative } from 'path';

// Dynamic import of rolldown to avoid fsevents resolution issues at module load time
let rolldown = null;
async function getRolldown() {
  if (!rolldown) {
    rolldown = await import('rolldown');
  }
  return rolldown;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const isProd = argv.includes('--prod');
const isWatch = argv.includes('--watch');
const isDemoClient = argv.includes('--demo-client');
const isDemoServer = argv.includes('--demo-server');
const isHeadless = argv.includes('--headless');
const addonArg = argv.find((e) => e.startsWith('--addon='));
const addon = addonArg ? addonArg.replace(/^--addon=/, '') : null;

/**
 * Recursively get all TypeScript files in a directory
 * @param {string} dir
 * @param {string} root
 * @returns {string[]}
 */
async function getTypeScriptFiles(dir, root) {
  const files = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;
      if (entry.name.endsWith('.test.ts')) continue;
      if (entry.isDirectory()) {
        const subFiles = await getTypeScriptFiles(path.join(dir, entry.name), root);
        files.push(...subFiles);
      } else if (entry.name.endsWith('.ts')) {
        files.push('./' + relative(root, path.join(dir, entry.name)));
      }
    }
  } catch (e) {
    // ignore
  }
  return files;
}

// Transform addon name to class name (e.g., "image" -> "ImageAddon")
function getAddonEntryPoint(addonName) {
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

async function build(configs) {
  const rd = await getRolldown();
  if (isWatch) {
    const rebundles = [];
    for (const config of configs) {
      const rb = await rd.rolldown({
        ...config,
        watch: {
          include: ['**/*.{ts,js}'],
        },
      });
      rebundles.push(rb);
    }

    console.log('Watching for changes...');
    process.on('SIGINT', async () => {
      console.log('Stopping watch...');
      for (const rb of rebundles) {
        await rb.close();
      }
      process.exit(0);
    });
  } else {
    for (const config of configs) {
      // Add external for problematic native modules in pnpm environment
      const mergedConfig = {
        ...config,
        external: [...(config.external || []), 'fsevents', 'playwright', '@playwright/test', 'chokidar']
      };
      const rb = await rd.rolldown(mergedConfig);
      const { output } = await rb.generate();
      for (const chunk of output) {
        if (chunk.type === 'chunk') {
          if (chunk.fileName === config.output?.file) {
            console.log(`Built: ${chunk.fileName} (${(chunk.code.length / 1024).toFixed(1)} KB)`);
          }
        }
      }
      await rb.close();
    }
  }
}

async function main() {
  if (isDemoClient) {
    // Demo client build
    const configs = [
      {
        input: 'demo/client/client.ts',
        output: {
          file: 'demo/dist/client-bundle.js',
          format: 'iife',
          sourcemap: false,
        },
        external: ['util', 'os', 'fs', 'path', 'stream', 'Terminal'],
        alias: {
          '@xterm/xterm': '.',
          '@xterm/addon-attach': './addons/addon-attach/lib/addon-attach.mjs',
          '@xterm/addon-clipboard': './addons/addon-clipboard/lib/addon-clipboard.mjs',
          '@xterm/addon-fit': './addons/addon-fit/lib/addon-fit.mjs',
          '@xterm/addon-image': './addons/addon-image/lib/addon-image.mjs',
          '@xterm/addon-progress': './addons/addon-progress/lib/addon-progress.mjs',
          '@xterm/addon-search': './addons/addon-search/lib/addon-search.mjs',
          '@xterm/addon-serialize': './addons/addon-serialize/lib/addon-serialize.mjs',
          '@xterm/addon-web-fonts': './addons/addon-web-fonts/lib/addon-web-fonts.mjs',
          '@xterm/addon-web-links': './addons/addon-web-links/lib/addon-web-links.mjs',
          '@xterm/addon-webgl': './addons/addon-webgl/lib/addon-webgl.mjs',
          '@xterm/addon-unicode11': './addons/addon-unicode11/lib/addon-unicode11.mjs',
          '@xterm/addon-unicode-graphemes': './addons/addon-unicode-graphemes/lib/addon-unicode-graphemes.mjs',
          '@xterm/addon-ligatures': './addons/addon-ligatures/out-esbuild/LigaturesAddon',
        },
        treeshake: true,
        minify: isProd,
        sourcemap: !isProd,
        target: 'es2021',
      },
    ];
    await build(configs);
  } else if (isDemoServer) {
    // Demo server build
    const configs = [
      {
        input: 'demo/server/server.ts',
        output: {
          file: 'demo/dist/server-bundle.js',
          format: 'cjs',
          sourcemap: false,
        },
        external: ['node-pty'],
        platform: 'node',
        treeshake: true,
        minify: isProd,
        sourcemap: !isProd,
        target: 'node18',
      },
    ];
    await build(configs);
  } else if (isHeadless) {
    // Headless build
    const srcFiles = await getTypeScriptFiles(path.join(rootDir, 'src'), rootDir);
    const configs = [
      {
        input: 'src/headless/public/Terminal.ts',
        output: {
          file: 'headless/lib-headless/xterm-headless.mjs',
          format: 'esm',
          banner,
        },
        treeshake: true,
        minify: isProd,
        sourcemap: true,
        target: 'es2021',
        platform: 'node',
      },
      {
        input: srcFiles.filter(f => !f.includes('/browser/')).reduce((acc, f) => {
          const name = f.replace('./src/', '').replace('.ts', '');
          acc[name] = f;
          return acc;
        }, {}),
        output: {
          dir: 'out-esbuild/',
          format: 'cjs',
          entryFileNames: '[name].js',
        },
        treeshake: true,
        minify: isProd,
        sourcemap: true,
        target: 'es2021',
        platform: 'node',
        external: ['fs', 'path', 'util', 'os', 'stream', 'events', 'child_process', 'crypto'],
      },
    ];
    await build(configs);
  } else if (addon) {
    // Addon build
    const addonDir = path.join(rootDir, 'addons', `addon-${addon}`);
    const srcDir = path.join(addonDir, 'src');
    const testDir = path.join(addonDir, 'test');

    const srcFiles = await getTypeScriptFiles(srcDir, rootDir);
    const testFiles = addon !== 'ligatures' ? await getTypeScriptFiles(testDir, rootDir) : [];

    const srcInput = srcFiles.reduce((acc, f) => {
      const name = f.replace(`./addons/addon-${addon}/src/`, '').replace('.ts', '');
      acc[name] = f;
      return acc;
    }, {});

    const entryPoint = `addons/addon-${addon}/src/${getAddonEntryPoint(addon)}.ts`;

    const configs = [
      {
        input: entryPoint,
        output: {
          file: `addons/addon-${addon}/lib/addon-${addon}.mjs`,
          format: 'esm',
          banner,
        },
        treeshake: true,
        minify: isProd,
        sourcemap: true,
        target: 'es2021',
        platform: addon === 'ligatures' ? 'node' : 'browser',
      },
      {
        input: srcInput,
        output: {
          dir: `addons/addon-${addon}/out-esbuild/`,
          format: 'cjs',
          entryFileNames: '[name].js',
        },
        treeshake: true,
        minify: isProd,
        sourcemap: true,
        target: 'es2021',
        platform: addon === 'ligatures' ? 'node' : 'browser',
        external: addon === 'ligatures' ? ['fs', 'path', 'https', 'zlib', 'stream', 'http'] : [],
      },
    ];

    // Add test config for all addons except ligatures
    if (addon !== 'ligatures' && testFiles.length > 0) {
      const testInput = testFiles.reduce((acc, f) => {
        const name = f.replace(`./addons/addon-${addon}/test/`, '').replace('.ts', '');
        acc[name] = f;
        return acc;
      }, {});

      configs.push({
        input: testInput,
        output: {
          dir: `addons/addon-${addon}/out-esbuild-test/`,
          format: 'cjs',
          entryFileNames: '[name].js',
        },
        treeshake: false, // Don't treeshake tests
        minify: isProd,
        sourcemap: true,
        target: 'es2021',
      });
    }

    // Special case for addon-serialize - use its own tsconfig
    if (addon === 'serialize') {
      configs[0].tsconfig = 'addons/addon-serialize/src/tsconfig.json';
    }

    await build(configs);
  } else {
    // Core xterm.js build
    const browserFiles = await getTypeScriptFiles(path.join(rootDir, 'src/browser'), rootDir);
    const commonFiles = await getTypeScriptFiles(path.join(rootDir, 'src/common'), rootDir);
    const headlessFiles = await getTypeScriptFiles(path.join(rootDir, 'src/headless'), rootDir);
    const testFiles = await getTypeScriptFiles(path.join(rootDir, 'test'), rootDir);

    // Create input object with unique names
    const browserInput = browserFiles.reduce((acc, f) => {
      const name = f.replace('./src/browser/', '').replace('.ts', '');
      acc[name] = f;
      return acc;
    }, {});
    const commonInput = commonFiles.reduce((acc, f) => {
      const name = 'common/' + f.replace('./src/common/', '').replace('.ts', '');
      acc[name] = f;
      return acc;
    }, {});
    const headlessInput = headlessFiles.reduce((acc, f) => {
      const name = 'headless/' + f.replace('./src/headless/', '').replace('.ts', '');
      acc[name] = f;
      return acc;
    }, {});
    const testInput = testFiles.reduce((acc, f) => {
      const name = f.replace('./test/', '').replace('.ts', '');
      acc[name] = f;
      return acc;
    }, {});

    const configs = [
      {
        input: 'src/browser/public/Terminal.ts',
        output: {
          file: 'lib/xterm.mjs',
          format: 'esm',
          banner,
        },
        treeshake: true,
        minify: isProd,
        sourcemap: true,
        target: 'es2021',
      },
      {
        input: { ...browserInput, ...commonInput, ...headlessInput },
        output: {
          dir: 'out-esbuild/',
          format: 'cjs',
          entryFileNames: '[name].js',
        },
        treeshake: true,
        minify: isProd,
        sourcemap: true,
        target: 'es2021',
      },
      {
        input: testInput,
        output: {
          dir: 'out-esbuild-test/',
          format: 'cjs',
          entryFileNames: '[name].js',
        },
        treeshake: false,
        minify: isProd,
        sourcemap: true,
        target: 'es2021',
      },
    ];
    await build(configs);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
