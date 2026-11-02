const https = require('node:https');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { syncBuiltinESMExports } = require('node:module');
const path = require('node:path');
const AdmZip = require('adm-zip');
const scenario = process.env.GGFONTS_NETWORK;

if (process.env.GGFONTS_PLATFORM) {
  require('node:os').platform = () => process.env.GGFONTS_PLATFORM;
  const childProcess = require('node:child_process');
  childProcess.exec = (command, callback) => callback(null);
  let registrations = 0;
  childProcess.execFileSync = () => {
    registrations++;
    if (process.env.GGFONTS_REGISTRY === 'success' ||
        (process.env.GGFONTS_REGISTRY === 'partial' && registrations === 1)) return;
    throw new Error('Registry unavailable');
  };
  childProcess.spawn = () => {
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
  new URL(url);
  const request = new EventEmitter();
  request.destroy = () => {};
  request.setTimeout = () => {};
  setTimeout(() => {
    const metadata = String(url).includes('google-fonts.json') || String(url).includes('/webfonts/v1/');
    const failure = process.env.GGFONTS_NETWORK === 'failure';
    let body = metadata
      ? (process.env.GGFONTS_NETWORK === 'invalid' ? 'not json' : JSON.stringify({ items: [{ family: 'Fira Code', version: 'v1' }] }))
      : 'font fixture';
    if (!metadata && scenario === 'zip' && String(url).includes('/download?')) {
      const zip = new AdmZip();
      zip.addFile('static/FiraCode.ttf', Buffer.from('font fixture'));
      zip.addFile('OFL.txt', Buffer.from('license fixture'));
      body = zip.toBuffer();
    }
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
  }, 20);
  return request;
};

global.fetch = async () => {
  if (scenario === 'zip') throw new Error('Manifest unavailable');
  const filenames = scenario === 'nested'
    ? ['static/FiraCode.ttf', 'static/FiraCode-Bold.OTF']
    : scenario === 'traversal' ? ['../../../../escape.ttf'] : ['FiraCode.ttf'];
  return {
    ok: true,
    text: async () => ")]}'\n" + JSON.stringify({ manifest: {
      files: [{ filename: 'OFL.txt', contents: 'license fixture' }],
      fileRefs: filenames.map(filename => ({ filename, url: 'https://example.com/' + path.basename(filename), date: { seconds: 1 } }))
    } })
  };
};
