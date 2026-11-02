import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { run } from './helpers.js';

test('without a terminal, the default command prints help and exits successfully', t => {
  const result = run(t, []);
  assert.equal(result.status, 0, result.output);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /search/);
  assert.match(result.stdout, /install/);
  assert.doesNotMatch(result.output, /config|update/);
});

test('the existing help command still accepts a subcommand', t => {
  const result = run(t, ['help', 'search']);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /--max/);
});

for (const network of ['success', 'catalogue-guarded']) {
  test(`${network} search loads the keyless catalogue without writing a cache`, t => {
    const result = run(t, ['search', 'fira', '--max', '1'], { network });
    assert.equal(result.status, 0, result.output);
    assert(result.output.includes('https://fonts.google.com/metadata/fonts'), result.output);
    assert.match(result.output, /Fira Code/);
    assert.match(result.output, /1 more result/);
    assert.equal(fs.existsSync(result.dataDir), false);
    assert.equal(result.output.includes(String.fromCharCode(27) + '['), false);
  });
}

for (const [network, reason] of [
  ['catalogue-network', /Catalogue unavailable/],
  ['catalogue-http', /503 - Service Unavailable/],
  ['catalogue-invalid', /Unexpected token|JSON/],
  ['catalogue-schema', /Invalid font catalogue/],
  ['catalogue-missing', /Invalid font catalogue/]
]) {
  test(`${network} search reports the catalogue failure without writing resources`, t => {
    const result = run(t, ['search', 'fira'], { network });
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /Failed to load font catalogue:/);
    assert.match(result.output, reason);
    assert.equal(fs.existsSync(result.dataDir), false);
  });
}

test('legacy catalogue and key files are ignored and preserved', t => {
  const result = run(t, ['search', 'fira'], { prepare: home => {
    const directory = path.join(home, process.platform === 'win32' ? 'AppData/Local/ggfonts' : '.ggfonts');
    fs.mkdirSync(directory, { recursive: true });
    for (const filename of ['google-fonts.json', 'google-fonts.min.json', 'API_KEY']) {
      fs.writeFileSync(path.join(directory, filename), 'legacy contents');
    }
  } });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Fira Code/);
  for (const filename of ['google-fonts.json', 'google-fonts.min.json', 'API_KEY']) {
    assert.equal(fs.readFileSync(path.join(result.dataDir, filename), 'utf8'), 'legacy contents');
  }
});
