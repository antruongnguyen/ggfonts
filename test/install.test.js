import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { run, fontsPath, scratchDir } from './helpers.js';

test('exact installation does not require the catalogue', t => {
  const result = run(t, ['install', 'Fira Code'], { network: 'catalogue-network', platform: 'darwin' });
  assert.equal(result.status, 0, result.output);
  assert.equal(fs.readFileSync(path.join(result.home, 'Library/Fonts/FiraCode.ttf'), 'utf8'), 'font fixture');
  assert.doesNotMatch(result.output, /Fetching font catalogue/);
});

test('Windows fallback returns success after PowerShell exits and then removes its scratch directory', t => {
  const result = run(t, ['install', 'Fira Code'], { platform: 'win32' });
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(fs.readdirSync(path.join(result.dataDir, 'tmp')), []);
  assert(result.output.includes(`Location: ${path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts')}`), result.output);
  assert.match(result.output, /Installed files: 1/);
});

for (const platform of ['darwin', 'linux', 'win32']) {
  test(`${platform} preserves spaces in nested font filenames and installation paths`, t => {
    const result = run(t, ['install', 'Fira Code'], { network: 'spaces', platform, registry: 'success' });
    assert.equal(result.status, 0, result.output);
    const directory = fontsPath(result.home, platform);
    for (const filename of ['Fira Code Regular.ttf', 'Fira Code Bold.OTF']) {
      assert.equal(fs.readFileSync(path.join(directory, filename), 'utf8'), 'font fixture');
      assert(result.output.includes(`Downloaded ${filename}`), result.output);
      assert(result.output.includes(path.join('nested fonts', filename)), result.output);
      assert(result.output.includes('  - ' + filename), result.output);
    }
    assert(result.output.includes(`Location: ${directory}`), result.output);
    assert.deepEqual(fs.readdirSync(path.join(result.dataDir, 'tmp')), []);
    assert.equal(fs.existsSync(path.join(directory, 'OFL.txt')), false);
    assert.match(result.output, /Installation summary: Fira Code/);
    assert.match(result.output, /Installed files: 2/);
  });
}

test('Windows reports a partial registry installation as a failure when fallback fails', t => {
  const result = run(t, ['install', 'Fira Code'], {
    network: 'nested', platform: 'win32', registry: 'partial', powershell: 'failure'
  });
  assert.equal(result.status, 1, result.output);
  assert.equal(fs.existsSync(path.join(scratchDir(result), 'fonts/static/FiraCode-Bold.OTF')), true);
});

test('Windows fallback script copies and registers every font before returning', { skip: process.platform !== 'win32' }, t => {
  const result = run(t, ['install', 'Fira Code'], { network: 'spaces', platform: 'win32', powershell: 'failure' });
  assert.equal(result.status, 1, result.output);
  const script = path.join(scratchDir(result), 'ggfonts-install-system-wide.ps1');
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
  assert.equal(fs.readFileSync(path.join(fontsDir, 'Fira Code Regular.ttf'), 'utf8'), 'font fixture');
  assert.equal(fs.readFileSync(path.join(fontsDir, 'Fira Code Bold.OTF'), 'utf8'), 'font fixture');
  const registrations = fs.readFileSync(registryLog, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.deepEqual(registrations.map(entry => entry.file).sort(), ['Fira Code Bold.OTF', 'Fira Code Regular.ttf']);
  assert(registrations.every(entry => entry.key === String.raw`HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts`));
});
