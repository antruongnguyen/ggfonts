import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { run, fontsPath } from './helpers.js';

test('startup opens the font picker directly with an exit hint', t => {
  const result = run(t, [], { answers: ['__CANCEL__'] });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Choose a font/);
  assert.match(result.output, /Esc.*Ctrl\+C.*exit/);
  assert.doesNotMatch(result.output, /What would you like to do/);
  assert.match(result.output, /Font catalogue ready/);
  assert.match(result.output, /See you next time!/);
  assert.doesNotMatch(result.output, /Cancelled\./);
  assert.equal(fs.existsSync(result.dataDir), false);
});

test('cancelling confirmation leaves the filesystem untouched', t => {
  const result = run(t, [], { answers: ['Fira Code', '__CANCEL__'] });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Install Fira Code/);
  assert.match(result.output, /See you next time!/);
  assert.doesNotMatch(result.output, /Cancelled\./);
  assert.equal(fs.existsSync(result.dataDir), false);
});

test('declining installation returns to the picker without downloading', t => {
  const result = run(t, [], { answers: ['Fira Code', false, '__CANCEL__'] });
  assert.equal(result.status, 0, result.output);
  assert.equal(fs.existsSync(path.join(result.dataDir, 'tmp')), false);
});

test('startup catalogue failure exits with a clear error', t => {
  const result = run(t, [], { answers: [], network: 'catalogue-network' });
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /Failed to load font catalogue: Catalogue unavailable/);
  assert.doesNotMatch(result.output, /Choose a font/);
  assert.equal(fs.existsSync(result.dataDir), false);
});

test('an empty startup catalogue exits without opening the picker', t => {
  const result = run(t, [], { answers: [], network: 'catalogue-empty' });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /No fonts available/);
  assert.doesNotMatch(result.output, /Choose a font/);
  assert.equal(fs.existsSync(result.dataDir), false);
});

test('the picker reports a copy failure without claiming installation success', { skip: process.platform === 'win32' }, t => {
  const result = run(t, [], {
    answers: ['Fira Code', true, '__CANCEL__'],
    prepare: home => {
      fs.mkdirSync(path.dirname(fontsPath(home)), { recursive: true });
      fs.writeFileSync(fontsPath(home), 'blocking file');
    }
  });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /[Ff]ail|ENOTDIR/);
  assert.doesNotMatch(result.output, /Fira Code installed/);
});

test('Windows fallback failure is reported before returning to the picker', t => {
  const result = run(t, [], { platform: 'win32', powershell: 'failure', answers: ['Fira Code', true, '__CANCEL__'] });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Exited with code 1/);
  assert.doesNotMatch(result.output, /Fira Code installed/);
  assert.doesNotMatch(result.output, /Installation summary:/);
  assert.equal(result.output.split('Choose a font').length - 1, 2, result.output);
});

for (const platform of ['darwin', 'linux', 'win32']) {
  test(`${platform} interactive installation defaults to yes, shows the report, and returns to the picker`, t => {
    const result = run(t, [], { answers: ['Fira Code', '__DEFAULT__', '__CANCEL__'], network: 'nested', platform, registry: 'success' });
    assert.equal(result.status, 0, result.output);
    const installedDir = fontsPath(result.home, platform);
    assert.doesNotMatch(result.output, /Downloading |Downloaded |Stored at:|Save to:|Source:/);
    assert.equal(result.output.split('Choose a font').length - 1, 2, result.output);
    const summary = result.output.slice(result.output.indexOf('Installation summary:'));
    assert(summary.includes('Fira Code'), result.output);
    assert(summary.includes('Installed files: 2'), result.output);
    assert(summary.includes(`Location: ${installedDir}`), result.output);
    assert(summary.includes('  - FiraCode.ttf'), result.output);
    assert(summary.includes('  - FiraCode-Bold.OTF'), result.output);
    for (const filename of ['FiraCode.ttf', 'FiraCode-Bold.OTF']) {
      assert.equal(fs.readFileSync(path.join(installedDir, filename), 'utf8'), 'font fixture');
    }
  });
}
