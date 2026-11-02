import fs from 'fs';
import path from 'path';
import https from 'https';
import log from './log.js';

const { info, error, color } = log;

const MAX_REDIRECTS = 5;

const REDIRECT_STATUS_CODES = [301, 302, 303, 307, 308];

/**
 * Download a URL and follow up to `MAX_REDIRECTS` redirects
 *
 * @param {string} _url the URL to download
 * @param {(response: import('http').IncomingMessage) => void} _onSuccess invoked when a non-redirect response arrives
 * @param {(err: Error) => void} _onError invoked on network error or too many redirects
 * @param {number} _redirectsLeft remaining allowed redirects
 * @returns {void}
 */
const _download = function (_url, _onSuccess, _onError, _redirectsLeft = MAX_REDIRECTS) {
  const request = https.get(_url, function (response) {
    const {
      statusCode,
      statusMessage,
      headers
    } = response;
    if (REDIRECT_STATUS_CODES.includes(statusCode)) {
      // Drain the response to free the socket
      response.resume();
      const location = headers.location;
      if (!location || _redirectsLeft <= 0) {
        _onError(new Error(`Too many redirects or missing location header while downloading ${_url}`));
        return;
      }
      info(`[${statusCode} - ${statusMessage}] Redirecting to ${location}`);
      try {
        _download(new URL(location, _url).href, _onSuccess, _onError, _redirectsLeft - 1);
      } catch (err) {
        _onError(err);
      }
      return;
    }
    _onSuccess(response);
  });

  request.on('error', _onError);
  request.setTimeout(30000, () => request.destroy(new Error('Download timed out')));
  return request;
}

/**
 * Download a URL into a file. Creates the file atomically via a `.tmp` file.
 *
 * @param {string} _url the URL to download
 * @param {string} savingFilePath the destination file path
 * @returns {Promise<boolean>} resolves with `true` on success or `false` on failure
 */
export const download = function (_url, savingFilePath) {
  return new Promise(resolve => {
    info(`Downloading ${color.info(path.basename(savingFilePath))}\n  Save to: ${color.info(savingFilePath)}\n  Source: ${color.info(_url)}`);
    const tmp = savingFilePath + '.tmp';
    let settled = false;
    const finish = (success) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(success);
    };
    const discardTmp = () => fs.unlink(tmp, () => {});
    try {
      fs.mkdirSync(path.dirname(savingFilePath), { recursive: true });
    } catch (err) {
      error(err.message);
      finish(false);
      return;
    }
    const stream = fs.createWriteStream(tmp);
    stream.on('error', err => {
      error(err.message);
      request.destroy();
      discardTmp();
      finish(false);
    });

    const _onSuccess = function (response) {
      const {
        statusCode,
        statusMessage
      } = response;
      if (statusCode !== 200) {
        error(`[${statusCode} - ${statusMessage}] See https://httpstatusof.web.app/${statusCode}`);
        response.resume();
        stream.close(discardTmp);
        finish(false);
        return;
      }
      response.on('error', err => {
        error(err.message);
        stream.destroy();
        discardTmp();
        finish(false);
      });
      response.pipe(stream);
      stream.on('finish', () => {
        stream.close(() => {
          try {
            fs.copyFileSync(tmp, savingFilePath);
            fs.unlinkSync(tmp);
            info(`Downloaded ${color.info(path.basename(savingFilePath))}\n  Stored at: ${color.info(savingFilePath)}`);
            finish(true);
          } catch (err) {
            error(err.message);
            discardTmp();
            finish(false);
          }
        });
      });
    };

    const request = _download(_url, _onSuccess, (err) => {
      error(err.message);
      stream.close(discardTmp);
      finish(false);
    });
  });
}

export const fetchGoogleFontsJson = async function (url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(`[${response.status} - ${response.statusText}]`);
  }
  const text = await response.text();
  // Google prefixes some JSON responses with an anti-XSSI guard.
  return JSON.parse(text.startsWith(")]}'") ? text.slice(4).trimStart() : text);
};
