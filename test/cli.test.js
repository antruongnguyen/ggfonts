import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function run(t, args, { answers, network, seed = true, evaluate, prepare, platform, powershell } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ggfonts-test-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const dataDir = path.join(home, (platform || process.platform) === 'win32' ? 'AppData/Local/ggfonts' : '.ggfonts');
  fs.mkdirSync(dataDir, { recursive: true });
  if (prepare) prepare(home);
  if (seed) {
    fs.writeFileSync(path.join(dataDir, 'google-fonts.min.json'), JSON.stringify({ items: [
      { family: 'Fira Code', version: 'v1' }, { family: 'Fira Mono', version: 'v2' }
    ] }));
  }
  const loader = new URL('./fixtures/ui-loader.mjs', import.meta.url).href;
  const uiArgs = ['--import', `data:text/javascript,import { register } from 'node:module'; register(${JSON.stringify(loader)});`,
    '--input-type=module', '--eval', `import run from './commands/interactive.js'; await run();`];
  const cliArgs = evaluate ? ['--input-type=module', '--eval', evaluate] : ['index.js', ...args];
  const result = spawnSync(process.execPath, ['--require', './test/fixtures/network.cjs', ...(answers ? uiArgs : cliArgs)], {
    cwd: root, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: path.join(home, 'AppData/Local'),
      NO_COLOR: '1', FORCE_COLOR: '0', GGFONTS_NETWORK: network || 'success', GGFONTS_ANSWERS: JSON.stringify(answers),
      GGFONTS_PLATFORM: platform || '', GGFONTS_POWERSHELL: powershell || 'success' }
  });
  return { ...result, output: result.stdout + result.stderr, home, dataDir };
}

test('without a terminal, the default command prints help and exits successfully', t => {
  const result = run(t, []);
  assert.equal(result.status, 0, result.output);
  assert.match(result.stdout, /Usage:/);
});

test('the existing help command still accepts a subcommand', t => {
  const result = run(t, ['help', 'search']);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /--max/);
});

test('explicit search retains fuzzy results and the result limit without ANSI escapes', t => {
  const result = run(t, ['search', 'fira', '--max', '1']);
  assert.equal(result.status, 0, result.output);
  assert.match(result.stdout, /Fira Code/);
  assert.match(result.stdout, /1 more result/);
  assert.equal(result.output.includes(String.fromCharCode(27) + '['), false);
});

for (const network of ['failure', 'invalid']) {
  test(`metadata ${network} exits nonzero and preserves the cached catalogue`, t => {
    const result = run(t, ['update'], { network });
    assert.equal(result.status, 1, result.output);
    const data = JSON.parse(fs.readFileSync(path.join(result.dataDir, 'google-fonts.min.json')));
    assert.equal(data.items.length, 2);
    assert.doesNotMatch(result.output, /Updated Google Font metadata!/);
  });
}

test('successful metadata update writes a usable catalogue', t => {
  const result = run(t, ['update']);
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(result.dataDir, 'google-fonts.min.json'))).items, [{ family: 'Fira Code', version: 'v1' }]);
});

test('explicit config saves the API key without displaying the secret', t => {
  const result = run(t, ['config', '--key', 'private-test-key']);
  assert.equal(result.status, 0, result.output);
  assert.equal(fs.readFileSync(path.join(result.dataDir, 'API_KEY'), 'utf8').trim(), 'private-test-key');
  assert.doesNotMatch(result.output, /private-test-key/);
});

test('metadata update does not expose the configured API key in its download URL', t => {
  const result = run(t, ['update'], { prepare: home => {
    const keyDir = path.join(home, process.platform === 'win32' ? 'AppData/Local/ggfonts' : '.ggfonts');
    fs.writeFileSync(path.join(keyDir, 'API_KEY'), 'private-test-key');
  } });
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /private-test-key/);
});

test('a failed install exits nonzero without claiming success', t => {
  const result = run(t, ['install', 'Fira Code'], { network: 'failure' });
  assert.equal(result.status, 1, result.output);
  assert.doesNotMatch(result.output, /Installed .*font file/);
});

for (const answers of [['__CANCEL__'], ['fonts', '__CANCEL__'], ['fonts', 'Fira Code', '__CANCEL__'], ['config', 'key', '__CANCEL__']]) {
  test(`wizard cancellation ${JSON.stringify(answers)} leaves fonts and config untouched`, t => {
    const result = run(t, [], { answers });
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /Cancel/i);
    assert.equal(fs.existsSync(path.join(result.dataDir, 'API_KEY')), false);
    assert.equal(fs.existsSync(path.join(result.dataDir, 'tmp')), false);
  });
}

test('declining installation returns to the menu without downloading', t => {
  const result = run(t, [], { answers: ['fonts', 'Fira Code', false, 'exit'] });
  assert.equal(result.status, 0, result.output);
  assert.equal(fs.existsSync(path.join(result.dataDir, 'tmp')), false);
});

test('submitting an empty search result stays in the picker', t => {
  const result = run(t, [], { answers: ['fonts', '__EMPTY__', '__CANCEL__'] });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Cancelled/);
  assert.doesNotMatch(result.output, /undefined|Operation failed/);
});

test('the wizard saves a key then returns to its menu', t => {
  const result = run(t, [], { answers: ['config', 'key', 'private-test-key', 'exit'] });
  assert.equal(result.status, 0, result.output);
  assert.equal(fs.readFileSync(path.join(result.dataDir, 'API_KEY'), 'utf8').trim(), 'private-test-key');
  assert.doesNotMatch(result.output, /private-test-key/);
});

test('the wizard reports metadata failures and remains usable', t => {
  const result = run(t, [], { answers: ['update', 'exit'], network: 'failure' });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /[Ff]ail|[Uu]nable/);
  assert.doesNotMatch(result.output, /Updated Google Font metadata!/);
});

test('loading the picker on first use downloads a usable catalogue', t => {
  const result = run(t, [], { answers: ['fonts', '__CANCEL__'], seed: false });
  assert.equal(result.status, 0, result.output);
  assert.equal(JSON.parse(fs.readFileSync(path.join(result.dataDir, 'google-fonts.min.json'))).items[0].family, 'Fira Code');
});

const fontsPath = home => path.join(home, process.platform === 'darwin' ? 'Library/Fonts' : '.local/share/fonts');

test('awaiting installation returns success after the font files are copied', { skip: process.platform === 'win32' }, t => {
  const result = run(t, [], { evaluate: `
    import assert from 'node:assert/strict';
    import { downloadFont } from './utilities/fs_utility.js';
    assert.equal(await downloadFont('Fira Code'), true);
  ` });
  assert.equal(result.status, 0, result.output);
  assert.equal(fs.readFileSync(path.join(fontsPath(result.home), 'FiraCode.ttf'), 'utf8'), 'font fixture');
});

test('the wizard does not report installation success when fonts cannot be copied', { skip: process.platform === 'win32' }, t => {
  const result = run(t, [], {
    answers: ['fonts', 'Fira Code', true, 'exit'],
    prepare: home => {
      fs.mkdirSync(path.dirname(fontsPath(home)), { recursive: true });
      fs.writeFileSync(fontsPath(home), 'blocking file');
    }
  });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /[Ff]ail/);
  assert.doesNotMatch(result.output, /Fira Code installed/);
});

test('Windows fallback returns success after PowerShell exits and then removes its scratch directory', t => {
  const result = run(t, [], { platform: 'win32', evaluate: `
    import assert from 'node:assert/strict';
    import { downloadFont } from './utilities/fs_utility.js';
    assert.equal(await downloadFont('Fira Code'), true);
  ` });
  assert.equal(result.status, 0, result.output);
  assert.equal(fs.existsSync(path.join(result.dataDir, 'tmp/Fira+Code-v1')), false);
});

test('Windows fallback failure is reported before returning to the wizard menu', t => {
  const result = run(t, [], { platform: 'win32', powershell: 'failure', answers: ['fonts', 'Fira Code', true, 'exit'] });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Exited with code 1/);
  assert.doesNotMatch(result.output, /Fira Code installed/);
});
