const https = require('node:https');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { syncBuiltinESMExports } = require('node:module');

if (process.env.GGFONTS_PLATFORM === 'win32') {
  require('node:os').platform = () => 'win32';
  const childProcess = require('node:child_process');
  childProcess.execFileSync = () => { throw new Error('Registry unavailable'); };
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
  const request = new EventEmitter();
  setTimeout(() => {
    const metadata = String(url).includes('google-fonts.json') || String(url).includes('/webfonts/v1/');
    const failure = process.env.GGFONTS_NETWORK === 'failure';
    const body = metadata
      ? (process.env.GGFONTS_NETWORK === 'invalid' ? 'not json' : JSON.stringify({ items: [{ family: 'Fira Code', version: 'v1' }] }))
      : 'font fixture';
    const response = Readable.from([body]);
    response.statusCode = failure ? 503 : 200;
    response.statusMessage = failure ? 'Service Unavailable' : 'OK';
    response.headers = {};
    callback(response);
  }, 20);
  return request;
};

global.fetch = async () => ({
  ok: true,
  text: async () => JSON.stringify({ manifest: { fileRefs: [{ filename: 'FiraCode.ttf', url: 'https://example.com/FiraCode.ttf' }] } })
});
