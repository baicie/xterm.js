// @ts-check

import { spawn } from 'child_process';
import { readdir } from 'fs/promises';
import { argv } from 'process';

/**
 * @param {string} message
 */
function log(message) {
  console.info(`[\x1b[2m${new Date().toLocaleTimeString('en-GB')}\x1b[0m] ${message}`);
}

/**
 * @param {string} name
 * @param {string[]} extraArgs
 * @returns {Promise<number>}
 */
function runJob(name, extraArgs) {
  return new Promise((resolve) => {
    log(`Starting \x1b[32m${name}\x1b[0m...`);
    const args = [
      process.execPath,  // Use full path to node
      'bin/rolldown_build.mjs',
      ...extraArgs,
      ...argv,
    ];
    const cp = spawn(args[0], args.slice(1), { stdio: ['inherit', 'inherit', 'inherit'] });
    cp.on('exit', (code) => {
      log(`Finished \x1b[32m${name}\x1b[0m${code ? ' \x1b[31mwith errors\x1b[0m' : ''}`);
      resolve(code ?? 0);
    });
  });
}

async function main() {
  const jobs = [];

  // Core job
  jobs.push(runJob('xterm', []));

  // Addon jobs
  const addons = (await readdir('addons')).filter((e) => e.startsWith('addon-')).map((e) => e.replace('addon-', ''));
  for (const addon of addons) {
    jobs.push(runJob(`xterm-addon-${addon}`, [`--addon=${addon}`]));
  }

  await Promise.all(
    jobs.map((p) =>
      p.then((code) => {
        if (code) process.exitCode = 1;
      })
    )
  );
}

main();
