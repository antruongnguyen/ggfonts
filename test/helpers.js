import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

export function run(t, args, { answers, network, evaluate, prepare, platform, powershell, registry } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ggfonts test José's home-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const dataDir = path.join(home, (platform || process.platform) === 'win32' ? 'AppData/Local/ggfonts' : '.ggfonts');
  if (prepare) prepare(home);
  const loader = new URL('./fixtures/ui-loader.mjs', import.meta.url).href;
  const uiArgs = ['--import', `data:text/javascript,import { register } from 'node:module'; register(${JSON.stringify(loader)});`,
    '--input-type=module', '--eval', `import run from './src/interactive.js'; await run();`];
  const cliArgs = evaluate ? ['--input-type=module', '--eval', evaluate] : ['index.js', ...args];
  const result = spawnSync(process.execPath, ['--require', './test/fixtures/network.cjs', ...(answers ? uiArgs : cliArgs)], {
    cwd: root, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: path.join(home, 'AppData/Local'),
      NO_COLOR: '1', FORCE_COLOR: '0', GGFONTS_NETWORK: network || 'success', GGFONTS_ANSWERS: JSON.stringify(answers),
      GGFONTS_PLATFORM: platform || '', GGFONTS_POWERSHELL: powershell || 'success', GGFONTS_REGISTRY: registry || '' }
  });
  return { ...result, output: result.stdout + result.stderr, home, dataDir };
}

export function scratchDir(result) {
  const directory = path.join(result.dataDir, 'tmp');
  const entries = fs.readdirSync(directory);
  assert.equal(entries.length, 1);
  return path.join(directory, entries[0]);
}

export const fontsPath = (home, platform = process.platform) => path.join(home,
  platform === 'darwin' ? 'Library/Fonts' : platform === 'linux' ? '.local/share/fonts' : 'AppData/Local/Microsoft/Windows/Fonts');
