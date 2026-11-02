import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function run(t, args, { answers, network, seed = true, evaluate, prepare, platform, powershell, registry } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ggfonts-test-José-'));
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
      GGFONTS_PLATFORM: platform || '', GGFONTS_POWERSHELL: powershell || 'success', GGFONTS_REGISTRY: registry || '' }
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
  assert.match(result.output, /[Ff]ail|ENOTDIR/);
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

for (const platform of ['darwin', 'linux', 'win32']) {
  test(`${platform} installs every nested manifest font into the user font directory`, t => {
    const result = run(t, ['install', 'Fira Code'], { network: 'nested', platform, registry: 'success' });
    assert.equal(result.status, 0, result.output);
    const directory = path.join(result.home, platform === 'darwin' ? 'Library/Fonts'
      : platform === 'linux' ? '.local/share/fonts' : 'AppData/Local/Microsoft/Windows/Fonts');
    assert.equal(fs.readFileSync(path.join(directory, 'FiraCode.ttf'), 'utf8'), 'font fixture');
    assert.equal(fs.readFileSync(path.join(directory, 'FiraCode-Bold.OTF'), 'utf8'), 'font fixture');
    assert.equal(fs.existsSync(path.join(result.dataDir, 'tmp/Fira+Code-v1')), false);
  });
}

test('ZIP fallback extracts nested font files and installs them without copying the license', t => {
  const result = run(t, ['install', 'Fira Code'], { network: 'zip', platform: 'darwin' });
  assert.equal(result.status, 0, result.output);
  const directory = path.join(result.home, 'Library/Fonts');
  assert.equal(fs.readFileSync(path.join(directory, 'FiraCode.ttf'), 'utf8'), 'font fixture');
  assert.equal(fs.existsSync(path.join(directory, 'OFL.txt')), false);
});

test('manifest filenames cannot write outside the download directory', t => {
  const result = run(t, ['install', 'Fira Code'], { network: 'traversal' });
  assert.equal(result.status, 1, result.output);
  assert.equal(fs.existsSync(path.join(result.home, 'escape.ttf')), false);
});

test('relative download redirects resolve against the original URL', t => {
  const result = run(t, [], { network: 'redirect', evaluate: `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import os from 'node:os';
    import path from 'node:path';
    import { download } from './utilities/fs_utility.js';
    const destination = path.join(os.homedir(), 'font.ttf');
    assert.equal(await download('https://example.com/start', destination), true);
    assert.equal(fs.readFileSync(destination, 'utf8'), 'font fixture');
  ` });
  assert.equal(result.status, 0, result.output);
});

test('interrupted downloads preserve an existing file and remove the partial download', t => {
  const result = run(t, [], { network: 'aborted', evaluate: `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import os from 'node:os';
    import path from 'node:path';
    import { download } from './utilities/fs_utility.js';
    const destination = path.join(os.homedir(), 'font.ttf');
    fs.writeFileSync(destination, 'existing font');
    assert.equal(await download('https://example.com/font.ttf', destination), false);
    assert.equal(fs.readFileSync(destination, 'utf8'), 'existing font');
    assert.equal(fs.existsSync(destination + '.tmp'), false);
  ` });
  assert.equal(result.status, 0, result.output);
});

test('Windows reports a partial registry installation as a failure when fallback fails', t => {
  const result = run(t, ['install', 'Fira Code'], {
    network: 'nested', platform: 'win32', registry: 'partial', powershell: 'failure'
  });
  assert.equal(result.status, 1, result.output);
  assert.equal(fs.existsSync(path.join(result.dataDir, 'tmp/Fira+Code-v1/fonts/static/FiraCode-Bold.OTF')), true);
});

test('Windows fallback script copies and registers every font before returning', { skip: process.platform !== 'win32' }, t => {
  const result = run(t, ['install', 'Fira Code'], { network: 'nested', platform: 'win32', powershell: 'failure' });
  assert.equal(result.status, 1, result.output);
  const script = path.join(result.dataDir, 'tmp/Fira+Code-v1/ggfonts-install-system-wide.ps1');
  const fontsDir = path.join(result.home, 'Windows/Fonts');
  fs.mkdirSync(fontsDir, { recursive: true });
  const registryLog = path.join(result.home, 'registry.jsonl');
  const quote = value => value.replaceAll("'", "''");
  const wrapper = path.join(result.home, 'verify-fallback.ps1');
  fs.writeFileSync(wrapper, '\uFEFF' + `
    function New-ItemProperty {
      param($LiteralPath, $Name, $Value, $PropertyType, [switch]$Force)
      [pscustomobject]@{ key = $LiteralPath; name = $Name; file = $Value } |
        ConvertTo-Json -Compress | Add-Content -LiteralPath '${quote(registryLog)}'
    }
    $env:WINDIR = '${quote(path.join(result.home, 'Windows'))}'
    & '${quote(script)}'
  `);
  const executed = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapper], { encoding: 'utf8' });
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  assert.equal(fs.readFileSync(path.join(fontsDir, 'FiraCode.ttf'), 'utf8'), 'font fixture');
  assert.equal(fs.readFileSync(path.join(fontsDir, 'FiraCode-Bold.OTF'), 'utf8'), 'font fixture');
  const registrations = fs.readFileSync(registryLog, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.deepEqual(registrations.map(entry => entry.file).sort(), ['FiraCode-Bold.OTF', 'FiraCode.ttf']);
  assert(registrations.every(entry => entry.key === String.raw`HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts`));
});

for (const platform of ['darwin', 'linux', 'win32']) {
  test(`${platform} interactive installation retains download paths and a complete installed-file summary`, t => {
    const result = run(t, [], { answers: ['fonts', 'Fira Code', true, 'exit'], network: 'nested', platform, registry: 'success' });
    assert.equal(result.status, 0, result.output);
    const stagingDir = path.join(result.dataDir, 'tmp/Fira+Code-v1/fonts/static');
    const installedDir = path.join(result.home, platform === 'darwin' ? 'Library/Fonts'
      : platform === 'linux' ? '.local/share/fonts' : 'AppData/Local/Microsoft/Windows/Fonts');
    for (const filename of ['FiraCode.ttf', 'FiraCode-Bold.OTF']) {
      assert(result.output.includes(`Downloaded ${filename}`), result.output);
      assert(result.output.includes(`Stored at: ${path.join(stagingDir, filename)}`), result.output);
    }
    const summary = result.output.slice(result.output.indexOf('Installation summary:'));
    assert(summary.includes('Fira Code'), result.output);
    assert(summary.includes('Installed files: 2'), result.output);
    assert(summary.includes(`Location: ${installedDir}`), result.output);
    assert(summary.includes('  - FiraCode.ttf'), result.output);
    assert(summary.includes('  - FiraCode-Bold.OTF'), result.output);
  });
}

test('command-mode installation prints the installed-file summary', t => {
  const result = run(t, ['install', 'Fira Code'], { network: 'nested', platform: 'darwin' });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Installation summary: Fira Code/);
  assert.match(result.output, /Installed files: 2/);
  assert(result.output.includes(`Location: ${path.join(result.home, 'Library/Fonts')}`), result.output);
});

test('Windows fallback summary reports the system font directory', t => {
  const result = run(t, [], { answers: ['fonts', 'Fira Code', true, 'exit'], platform: 'win32' });
  assert.equal(result.status, 0, result.output);
  assert(result.output.includes(`Location: ${path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts')}`), result.output);
  assert.match(result.output, /Installed files: 1/);
});

test('failed installation does not print an installed-file summary', t => {
  const result = run(t, [], { answers: ['fonts', 'Fira Code', true, 'exit'], platform: 'win32', powershell: 'failure' });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Exited with code 1/);
  assert.doesNotMatch(result.output, /Installation summary:/);
});
