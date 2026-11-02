const https = require('node:https');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { syncBuiltinESMExports } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const scenario = process.env.GGFONTS_NETWORK;

if (process.env.GGFONTS_PLATFORM) {
  require('node:os').platform = () => process.env.GGFONTS_PLATFORM;
  const childProcess = require('node:child_process');
  childProcess.exec = (command, callback) => callback(null);
  let registrations = 0;
  childProcess.execFileSync = (command, args) => {
    assert.equal(command, 'reg');
    assert.equal(args[0], 'add');
    const destination = args[args.indexOf('/d') + 1];
    assert.equal(destination, path.join(process.env.LOCALAPPDATA, 'Microsoft/Windows/Fonts', path.basename(destination)));
    assert.equal(fs.readFileSync(destination, 'utf8'), 'font fixture');
    registrations++;
    if (process.env.GGFONTS_REGISTRY === 'success' ||
        (process.env.GGFONTS_REGISTRY === 'partial' && registrations === 1)) return;
    throw new Error('Registry unavailable');
  };
  childProcess.spawn = (command, args) => {
    assert.equal(command, 'powershell.exe');
    const scriptPath = args[args.indexOf('-File') + 1];
    assert.deepEqual(args, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]);
    assert(scriptPath.includes("José's home-"), scriptPath);
    const script = fs.readFileSync(scriptPath, 'utf8');
    assert.equal(script.charCodeAt(0), 0xfeff);
    const stagingDir = path.join(path.dirname(scriptPath), 'fonts').replaceAll("'", "''");
    assert(script.includes(`Get-ChildItem -LiteralPath '${stagingDir}'`), script);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end: () => {} };
    setTimeout(() => child.emit('exit', process.env.GGFONTS_POWERSHELL === 'failure' ? 1 : 0), 80);
    return child;
  };
  syncBuiltinESMExports();
}

https.get = (url, callback) => {
  const parsed = new URL(url);
  if (parsed.hostname !== 'example.com') throw new Error(`Unexpected resource request: ${url}`);
  const request = new EventEmitter();
  request.destroy = () => {};
  request.setTimeout = () => {};
  setTimeout(() => {
    const failure = process.env.GGFONTS_NETWORK === 'failure';
    const body = 'font fixture';
    const response = Readable.from([body]);
    response.statusCode = failure ? 503 : 200;
    response.statusMessage = failure ? 'Service Unavailable' : 'OK';
    response.headers = {};
    if (scenario === 'redirect' && String(url) === 'https://example.com/start') {
      response.statusCode = 302;
      response.headers.location = '/FiraCode.ttf';
    }
    if (scenario === 'aborted') {
      response._read = () => {
        response.push('partial font');
        response.destroy(new Error('Connection interrupted'));
      };
    }
    callback(response);
  }, scenario === 'slow' ? 5000 : 20);
  return request;
};

global.fetch = async url => {
  if (String(url) === 'https://fonts.google.com/metadata/fonts') {
    if (scenario === 'catalogue-slow') await new Promise(resolve => setTimeout(resolve, 5000));
    if (scenario === 'catalogue-network') throw new Error('Catalogue unavailable');
    if (scenario === 'catalogue-http') return { ok: false, status: 503, statusText: 'Service Unavailable' };
    if (scenario === 'catalogue-invalid') return { ok: true, text: async () => '<html>Not a catalogue</html>' };
    const families = scenario === 'catalogue-empty' ? [] : scenario === 'catalogue-schema' ? [{ family: null }] : [
      { family: 'Fira Code', category: 'Monospace', lastModified: '2025-01-01' },
      { family: 'Fira Mono', category: 'Monospace', lastModified: '2025-01-01' }
    ];
    const data = scenario === 'catalogue-missing' ? {} : { familyMetadataList: families };
    return { ok: true, text: async () => (scenario === 'catalogue-guarded' ? ")]}'\n" : '') + JSON.stringify(data) };
  }
  const manifestUrl = new URL(url);
  if (manifestUrl.origin !== 'https://fonts.google.com' || manifestUrl.pathname !== '/download/list' ||
      manifestUrl.searchParams.get('family') !== 'Fira Code') throw new Error(`Unexpected manifest request: ${url}`);
  if (scenario === 'manifest-network') throw new Error('Manifest unavailable');
  if (scenario === 'manifest-http') return { ok: false, status: 503, statusText: 'Service Unavailable' };
  if (scenario === 'manifest-invalid') return { ok: true, text: async () => '<html>Not a manifest</html>' };
  const filenames = scenario === 'nested'
    ? ['static/FiraCode.ttf', 'static/FiraCode-Bold.OTF']
    : scenario === 'spaces' ? ['nested fonts/Fira Code Regular.ttf', 'nested fonts/Fira Code Bold.OTF']
    : scenario === 'traversal' ? ['../../../../escape.ttf'] : scenario === 'manifest-empty' ? [] : ['FiraCode.ttf'];
  return {
    ok: true,
    text: async () => ")]}'\n" + JSON.stringify({ manifest: {
      files: [{ filename: 'OFL.txt', contents: 'license fixture' }],
      fileRefs: filenames.map(filename => ({ filename, url: 'https://example.com/' + encodeURIComponent(path.basename(filename)), date: { seconds: 1 } }))
    } })
  };
};
