import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { run } from './helpers.js';

test('a failed install exits nonzero without claiming success', t => {
  const result = run(t, ['install', 'Fira Code'], { network: 'failure' });
  assert.equal(result.status, 1, result.output);
  assert.doesNotMatch(result.output, /Installed .*font file/);
});

for (const [network, reason] of [
  ['manifest-network', /Manifest unavailable/],
  ['manifest-http', /503 - Service Unavailable/],
  ['manifest-invalid', /Unexpected token|JSON/],
  ['manifest-empty', /No files found in the manifest/]
]) {
  test(`${network} exits nonzero with the manifest error and no alternate download`, t => {
    const result = run(t, ['install', 'Fira Code'], { network, platform: 'darwin' });
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /File list download failed:/);
    assert.match(result.output, reason);
    assert.equal(result.output.includes('https://fonts.google.com/download?'), false, result.output);
    assert.doesNotMatch(result.output, /Installation summary:|Installed .*font file/);
    assert.equal(fs.existsSync(path.join(result.home, 'Library/Fonts')), false);
  });
}

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
    import { download } from './src/download.js';
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
    import { download } from './src/download.js';
    const destination = path.join(os.homedir(), 'font.ttf');
    fs.writeFileSync(destination, 'existing font');
    assert.equal(await download('https://example.com/font.ttf', destination), false);
    assert.equal(fs.readFileSync(destination, 'utf8'), 'existing font');
    assert.equal(fs.existsSync(destination + '.tmp'), false);
  ` });
  assert.equal(result.status, 0, result.output);
});
