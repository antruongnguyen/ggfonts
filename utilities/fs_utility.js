import os from 'os';
import fs from 'fs';
import path from 'path';
import https from 'https';
import {
  exec,
  execFileSync,
  spawn
} from 'child_process';
import AdmZip from 'adm-zip';
import FuzzySearch from 'fuzzy-search';
import log from './console_utility.js';

const {
  info,
  warn,
  error,
  done,
  color
} = log;

/**
 * Possible values are `'aix'`, `'darwin'`, `'freebsd'`,`'linux'`,`'openbsd'`, `'sunos'`, and `'win32'`.
 */
const platform = os.platform();

const isWindows = platform === 'win32';

const isMacOS = platform === 'darwin';

const isLinux = platform === 'linux';

const home = os.homedir();
const userFontsDirMacOS = path.join(home, 'Library', 'Fonts');
const userFontsDirLinux = path.join(home, '.local', 'share', 'fonts');
const ggfontsDir = isWindows ? path.join(home, 'AppData', 'Local', 'ggfonts') : path.join(home, '.ggfonts');
const apiKeyFilePath = path.join(ggfontsDir, 'API_KEY');
const googleFontsFilePath = path.join(ggfontsDir, 'google-fonts.json');
const googleFontMinFilePath = path.join(ggfontsDir, 'google-fonts.min.json');

const fontExts = ['ttf', 'otf'];

const emptyStr = '';

/**
 * Validate whether a path is existed or not
 *
 * @param {string} _path a file or directory path
 * @returns {boolean} true | false
 */
const exists = (_path) => fs.existsSync(_path);

/**
 * Validate whether a path is a file or not
 *
 * @param {string} _path a path to evaluate
 * @returns {boolean} true | false
 */
const isFile = (_path) => fs.lstatSync(_path).isFile();

/**
 * Get a file name extension from a path
 *
 * @param {string} _path a path to evaluate
 * @returns {string} the extention in lowercase
 */
const getFileExt = (_path) => path.extname(_path).toLowerCase();

/**
 * Get the directory path
 *
 * @param {string} _path a path to evaluate
 * @returns {string} the parent path of a file or the path of the directory
 */
const getDirPath = (_path) => path.dirname(_path);

/**
 * Ensure the input value is an array
 *
 * @param {*[]} _values the values to evaluate
 * @returns {*[]} empty if the input param is not an array. Otherwise, returns the param value itself.
 */
const arrayOf = (_values) => Array.isArray(_values) ? _values : [];

// Make use of String.indludes(), Array.includes(), Object.hasOwnProperty(). Otherwise, return false
/**
 * Verify an item contains a value. It makes use of `String.indludes()`, `Array.includes()`, and `Object.hasOwnProperty()` to evaluate the value from a search item.
 *
 * @param {*[]|string|object} searchItem the target item
 * @param {*} searchValue the value to verify
 * @returns {boolean} `true` if `seachItem` includes (for string or array value) the `searchValue` or has a property name (for object item) equals to the `searchValue`. Otherwise, returns `false`
 */
const contains = function (searchItem, searchValue) {
  if (searchItem === null) {
    return searchItem === searchValue;
  }

  if (Array.isArray(searchItem) || (typeof searchItem === 'string')) {
    return searchItem.includes(searchValue);
  }

  if (typeof searchItem === 'object') {
    return searchItem.hasOwnProperty(searchValue + '');
  }

  return false;
};

/**
 * Verify an item contains at least a value from the provided values.
 *
 * @param {*[]|string|object} searchItem the target item
 * @param {*[]} searchValues the values to evaluate
 * @returns `true` if `searchItem` contains any value from `searchValue`. Otherwise, returns `false`.
 * @see {contains}
 */
const containsAny = function (searchItem, searchValues = []) {
  searchValues = arrayOf(searchValues);
  return searchValues.filter(part => contains(searchItem, part)).length !== 0;
};

/**
 * Create directory recursively
 *
 * @param {string} dirPath a path of directory to create
 * @param {boolean} recursive will create the directory recursively if its parents are not existed? Default to `true`
 * @returns {void} no return
 */
const mkdir = function (dirPath, recursive = true) {
  try {
    if (exists(dirPath)) {
      return;
    }

    fs.mkdirSync(dirPath, {
      recursive: recursive
    });
  } catch (err) {
    error(err.message);
  }
}

// Create new file. Overwrite the file if exists.
const mkfile = function (filePath, content = emptyStr, mode = 'w+') {
  try {
    if (content !== emptyStr) {
      content += os.EOL;
    }

    // Ensure parent directory exists
    mkdir(getDirPath(filePath));

    // Create new file
    fs.writeFileSync(filePath, content, {
      flag: mode
    });
  } catch (err) {
    error(err.message);
  }
}

// Read file content in UTF-8 encode
const readfile = function (filePath, verbose = false) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (verbose) {
      error(err.message);
    }
    return emptyStr;
  }
}

// Copy files from from a directory to another directory
const copyFiles = function (fromDirPath, toDirPath, copyFileExtensions = []) {
  if (!exists(fromDirPath)) {
    warn(`Source directory not found: ${fromDirPath}`);
    return 0;
  }
  copyFileExtensions = arrayOf(copyFileExtensions);
  // Ensure target directory exists before copying into it or its sub-directories
  mkdir(toDirPath);
  let copiedCount = 0;
  fs.readdirSync(fromDirPath)
    .forEach(fileName => {
      const _fromPath = path.join(fromDirPath, fileName);
      const _toPath = path.join(toDirPath, fileName);
      if (isFile(_fromPath)) {
        if (copyFileExtensions.length !== 0 && !containsAny(getFileExt(fileName), copyFileExtensions)) {
          return;
        }
        info(`Copy ${color.info(_fromPath)} to ${color.info(toDirPath)}`);
        fs.copyFileSync(_fromPath, _toPath);
        copiedCount++;
        return;
      }
      copiedCount += copyFiles(_fromPath, toDirPath, copyFileExtensions);
    });
  return copiedCount;
}

/**
 * Construct URL to download Google Fonts metadata
 *
 * @returns The URL
 */
const googleFontsMetaUrl = function () {
  const apiKey = readfile(apiKeyFilePath).trim();
  if (apiKey) {
    // Has API Key configured
    // https://developers.google.com/fonts/docs/developer_api
    return `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}`;
  }
  return 'https://raw.githubusercontent.com/antruongnguyen/ggfonts/main/google-fonts.json';
}

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
    info(`Downloading ${color.info(path.basename(savingFilePath))}\n  Save to: ${color.info(savingFilePath)}\n  Source: ${color.info(_url.replace(/([?&]key=)[^&]*/g, '$1[hidden]'))}`);
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
        if (contains(_url, 'www.googleapis.com')) {
          error('Invalid Google Fonts API Key!');
        }
        info(`In case you configured an invalid Google Fonts API Key, you could remove ${color.info(apiKeyFilePath)} file or create a new Key by following the instructions at https://developers.google.com/fonts/docs/developer_api`);
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

/**
 * Recursively remove a directory (best effort)
 *
 * @param {string} dirPath the directory path to remove
 * @returns {void}
 */
const rmdir = function (dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (err) {
    warn(`Could not remove ${dirPath}: ${err.message}`);
  }
}

/**
 * Collect font files (*.ttf, *.otf) from a directory recursively
 *
 * @param {string} dirPath the directory to scan
 * @returns {string[]} absolute paths of found font files
 */
const collectFontFiles = function (dirPath) {
  const results = [];
  const walk = (_dir) => {
    fs.readdirSync(_dir).forEach(fileName => {
      const _path = path.join(_dir, fileName);
      if (!isFile(_path)) {
        walk(_path);
        return;
      }
      if (containsAny(getFileExt(_path), fontExts)) {
        results.push(_path);
      }
    });
  };
  walk(dirPath);
  return results;
};

/**
 * Extract a font ZIP archive into a destination directory
 *
 * @param {string} zipPath the archive path
 * @param {string} destDir the extraction destination directory
 * @returns {string|null} the extraction directory if fonts were extracted, otherwise `null`
 */
const extractFontArchive = function (zipPath, destDir) {
  try {
    mkdir(destDir);
    new AdmZip(zipPath).extractAllTo(destDir, true);
    const fontFiles = collectFontFiles(destDir);
    if (fontFiles.length === 0) {
      throw new Error('No font files found inside the archive');
    }
    info(`Extracted ${color.info(fontFiles.length + '')} font file(s) to ${color.info(destDir)}`);
    return destDir;
  } catch (err) {
    warn(`Failed to extract archive: ${err.message}`);
    return null;
  }
};

/**
 * Download a font via the Google Fonts file list endpoint
 * (`https://fonts.google.com/download/list?family=<name>`), which returns a JSON
 * manifest (prefixed by `)]}'`) of direct file URLs.
 *
 * @param {string} name an exact font name
 * @param {string} destDir the directory to download font files into
 * @returns {Promise<string|null>} the directory containing downloaded files, or `null` on failure
 */
const downloadFontFromFileList = async function (name, destDir) {
  try {
    const url = `https://fonts.google.com/download/list?family=${encodeURIComponent(name)}`;
    info(`Fetching file list for ${color.info(name)}: ${color.info(url)}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      throw new Error(`[${response.status} - ${response.statusText}]`);
    }
    const text = await response.text();
    // Strip the XSS guard prefix `)]}'` if present
    const json = JSON.parse(text.replace(/^\)\]\}'\s*/, ''));
    const fileRefs = arrayOf(json.manifest && json.manifest.fileRefs)
      .filter(fileRef => fontExts.includes(getFileExt(fileRef.filename).slice(1)));
    if (fileRefs.length === 0) {
      throw new Error('No files found in the manifest');
    }
    rmdir(destDir);
    mkdir(destDir);
    for (const fileRef of fileRefs) {
      const destination = path.resolve(destDir, fileRef.filename);
      const relativePath = path.relative(destDir, destination);
      if (relativePath.startsWith('..' + path.sep) || path.isAbsolute(relativePath)) {
        throw new Error(`Invalid font filename: ${fileRef.filename}`);
      }
      const saved = await download(fileRef.url, destination);
      if (!saved) {
        throw new Error(`Failed to download ${fileRef.filename}`);
      }
    }
    return destDir;
  } catch (err) {
    error(`File list download failed: ${err.message}`);
    return null;
  }
};

/**
 * Download and install a font by provided name from Google Fonts.
 * Uses the Google Fonts file list endpoint; falls back to a ZIP archive
 * when the manifest is unavailable.
 *
 * @param {string} name an exact font name
 * @returns {Promise<boolean>} whether installation completed
 */
export const downloadFont = async function (name) {
  await ensureDataExists();
  const version = getFontVersion(name);
  if (version === emptyStr) {
    warn(`No font found with name: ${color.warn(name)}`);
    await searchFont(name);
    return false;
  }
  const safeName = name.replaceAll(' ', '+');
  const workDir = path.join(ggfontsDir, 'tmp', `${safeName}-${version}`);
  rmdir(workDir);
  mkdir(workDir);
  const zipPath = path.join(workDir, `${safeName}-${version}.zip`);
  const extractDir = path.join(workDir, 'fonts');

  info(`Installing font ${color.info(name)} ${color.info(`(v${version.replace(/^v/, emptyStr)})`)}`);
  let fontsSourceDir = await downloadFontFromFileList(name, extractDir);
  if (!fontsSourceDir) {
    warn('File list download failed. Trying the Google Fonts ZIP endpoint...');
    rmdir(extractDir);
    const downloaded = await download(`https://fonts.google.com/download?family=${encodeURIComponent(name)}`, zipPath);
    fontsSourceDir = downloaded ? extractFontArchive(zipPath, extractDir) : null;
  }
  if (!fontsSourceDir) {
    error(`Could not download font ${color.warn(name)}. Please verify the font name and your network connection.`);
    return false;
  }

  return installFonts(name, fontsSourceDir, workDir);
}

export const updateGoogleFontsMeta = async function () {
  mkdir(ggfontsDir);
  if (!await download(googleFontsMetaUrl(), googleFontsFilePath)) {
    throw new Error('Failed to download the font catalogue.');
  }
  const jsonText = readfile(googleFontsFilePath);
  const data = JSON.parse(jsonText);
  if (!Array.isArray(data.items) || !data.items.every(item => item && typeof item.family === 'string' && typeof item.version === 'string')) {
    throw new Error('Invalid font catalogue. Expected font families and versions.');
  }
  const metaContent = JSON.stringify({
    items: data.items.map(item => Object.assign({}, {
      family: item.family,
      version: item.version
    }))
  });
  info(`Optimize and minify the metadata ${color.info(googleFontsFilePath)} to ${color.info(googleFontMinFilePath)}`);
  fs.writeFileSync(googleFontMinFilePath, metaContent);
  done('Updated Google Font metadata!');
}

export const configApiKey = function (apiKey) {
  fs.mkdirSync(ggfontsDir, { recursive: true });
  fs.writeFileSync(apiKeyFilePath, apiKey + os.EOL, { mode: 0o600 });
  info(`API Key is saved to ${color.info(apiKeyFilePath)}`);
  info(`To use the pre-downloaded Google Fonts metadata, you could remove the file ${color.info(apiKeyFilePath)}`);
}

export const removeApiKey = function () {
  if (exists(apiKeyFilePath)) {
    fs.unlinkSync(apiKeyFilePath);
  }
}

const search = function (name) {
  const data = JSON.parse(readfile(googleFontMinFilePath));
  const searcher = new FuzzySearch(data.items, ['family'], {
    caseSensitive: false,
  });
  return searcher.search(name.trim());
}

export const searchFont = async function (name, maxResultLimit = 10) {
  await ensureDataExists();
  info(`Search font by keyword: ${color.info(name)}`);
  const results = search(name);
  if (results.length === 0) {
    info('No font found!');
    return;
  }
  info(`Found ${color.info(results.length)} fonts:`);
  let count = 0;
  results.forEach(item => {
    count++;
    if (count > maxResultLimit) {
      return;
    }
    info(`${(count+'').padStart(2, ' ')}. ${color.info(item.family)}`);
  });
  if (count > maxResultLimit) {
    info(`... and ${count - maxResultLimit} more results`);
  }
}

export const getFonts = async function () {
  await ensureDataExists();
  return JSON.parse(readfile(googleFontMinFilePath)).items;
}

/**
 * Get font version by name
 *
 * @param {string} name an exact font name
 * @returns {string} the version of the font
 */
export const getFontVersion = function (name) {
  const data = JSON.parse(readfile(googleFontMinFilePath));
  const results = data.items.filter(item => item.family === name);
  if (results.length === 1) {
    return results[0].version;
  }
  // Not found
  return emptyStr;
};

const ensureDataExists = async function () {
  if (exists(googleFontMinFilePath)) {
    return;
  }
  warn('No local data found! Updating Google Fonts metadata...');
  await updateGoogleFontsMeta();
}

const installFontsOnMacOS = (fontsDirPath) => {
  mkdir(userFontsDirMacOS);
  const copiedCount = copyFiles(fontsDirPath, userFontsDirMacOS, fontExts);
  if (copiedCount > 0) {
    done(`Installed ${copiedCount} font file(s) to ${color.info(userFontsDirMacOS)}`);
  }
  return copiedCount;
};

/**
 * Read and parse `/etc/os-release` into a key/value map
 *
 * @returns {object} e.g. `{ ID: 'ubuntu', PRETTY_NAME: 'Ubuntu 22.04...' }`. Empty object if the file is unavailable.
 */
const readOsRelease = function () {
  const map = {};
  readfile('/etc/os-release').split(/\r?\n/).forEach(line => {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match) {
      map[match[1]] = match[2].replace(/^["']|["']$/g, emptyStr);
    }
  });
  return map;
};

/**
 * Refresh the fontconfig cache by executing `fc-cache -f`
 *
 * @returns {Promise<void>} resolves when `fc-cache` exits or is found missing
 */
const refreshLinuxFontCache = function () {
  return new Promise(resolve => {
    exec('fc-cache -f', err => {
      if (err) {
        warn(`Could not refresh the font cache (${err.message.split('\n')[0]}). Restart your applications to pick up the new fonts.`);
      } else {
        done('Font cache updated (fc-cache -f).');
      }
      resolve();
    });
  });
};

/**
 * Install fonts for any Linux distro into the user font directory (`~/.local/share/fonts`),
 * then refresh the font cache with `fc-cache -f` when available. User-level installs work
 * on all distros without root privileges.
 *
 * @param {string} fontsDirPath a directory which contains *.ttf and/or *.otf files
 * @returns {Promise<number>} number of installed font files
 */
const installFontsOnLinux = async (fontsDirPath) => {
  const release = readOsRelease();
  info(`Detected Linux distro: ${color.info(release.PRETTY_NAME || os.type())}`);

  mkdir(userFontsDirLinux);
  const copiedCount = copyFiles(fontsDirPath, userFontsDirLinux, fontExts);
  if (copiedCount > 0) {
    done(`Installed ${copiedCount} font file(s) to ${color.info(userFontsDirLinux)}`);
    await refreshLinuxFontCache();
  }
  return copiedCount;
};

const winUserFontsDir = () => path.join(
  process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'),
  'Microsoft', 'Windows', 'Fonts'
);

const winUserFontsRegistryKey = 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts';

/**
 * Register an installed per-user font in the Windows registry
 *
 * @param {string} fontPath absolute path of the installed font file
 * @throws {Error} when `reg add` fails
 */
const registerFontInWindowsRegistry = function (fontPath) {
  const valueName = `${path.basename(fontPath).replace(/\.[^.]+$/, emptyStr)} (TrueType)`;
  execFileSync('reg', ['add', winUserFontsRegistryKey, '/v', valueName, '/t', 'REG_SZ', '/d', fontPath, '/f'], {
    stdio: 'ignore',
    windowsHide: true
  });
};

/**
 * Copy and register fonts system-wide on Windows using PowerShell.
 * Requires an elevated terminal. Used as fallback when the
 * per-user installation is unavailable.
 *
 * @param {string} fontsDirPath a directory which contains *.ttf and/or *.otf files
 * @param {string} scriptDir directory to place the generated PowerShell script in
 * @returns {Promise<string>} the font installation directory when PowerShell succeeds
 */
const installFontsOnWindowsSystemWide = async function (fontsDirPath, scriptDir) {
  const installScriptPath = path.join(scriptDir, 'ggfonts-install-system-wide.ps1');
  // Escape single quotes for PowerShell single-quoted literals
  const escapedDirPath = fontsDirPath.replaceAll("'", "''");
  // Windows PowerShell 5.1 needs a BOM to read non-ASCII paths as UTF-8.
  mkfile(installScriptPath, '\uFEFF' + [
    `$ErrorActionPreference = 'Stop'`,
    `$target = Join-Path $env:WINDIR 'Fonts'`,
    `Get-ChildItem -LiteralPath '${escapedDirPath}' -Recurse -File | Where-Object { $_.Extension -in '.ttf', '.otf' } | ForEach-Object {`,
    `  $destination = Join-Path $target $_.Name`,
    `  Copy-Item -LiteralPath $_.FullName -Destination $destination -Force`,
    `  $type = if ($_.Extension -ieq '.otf') { 'OpenType' } else { 'TrueType' }`,
    String.raw`  New-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts' -Name ($_.BaseName + ' (' + $type + ')') -Value $_.Name -PropertyType String -Force | Out-Null`,
    `}`
  ].join(os.EOL));

  info(`Executing ${color.info(installScriptPath)} to install fonts system-wide...`);
  return new Promise((resolve, reject) => {
    const powershell = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installScriptPath]);
    powershell.stdout.on('data', data => info('[PowerShell]', data.toString().trim()));
    powershell.stderr.on('data', data => error('[PowerShell]', data.toString().trim()));
    powershell.on('error', err => {
      reject(new Error(`[PowerShell] Could not be launched: ${err.message}`));
    });
    powershell.on('exit', code => {
      if (code === 0) {
        info('[PowerShell] Done!');
        resolve(path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'));
      } else {
        reject(new Error(`[PowerShell] Exited with code ${code}. Please install the fonts manually by copying them to 'C:\\Windows\\Fonts'.`));
      }
    });
    powershell.stdin.end();

    info(`[Notice] If any error occurred, please install the fonts manually by copying fonts from '${fontsDirPath}' to 'C:\\Windows\\Fonts'`);
  });
};

/**
 * Install fonts for the current Windows user without admin privileges:
 * copies fonts to `%LOCALAPPDATA%\Microsoft\Windows\Fonts` and registers each
 * font under `HKCU\...\CurrentVersion\Fonts`. Falls back to a system-wide
 * installation when the per-user approach fails.
 *
 * @param {string} fontsDirPath a directory which contains *.ttf and/or *.otf files
 * @param {string} scriptDir directory used for the fallback PowerShell script
 * @returns {Promise<string|false>} the installation directory, or `false` when no fonts were found
 */
const installFontsOnWindows = async function (fontsDirPath, scriptDir) {
  const fontFiles = collectFontFiles(fontsDirPath);
  if (fontFiles.length === 0) {
    warn(`No ${fontExts.join('/') || 'font'} files found in ${fontsDirPath}`);
    return false;
  }

  const targetDir = winUserFontsDir();
  mkdir(targetDir);

  let installedCount = 0;
  let copyFailures = 0;
  fontFiles.forEach(fontFile => {
    const destPath = path.join(targetDir, path.basename(fontFile));
    try {
      fs.copyFileSync(fontFile, destPath);
    } catch (err) {
      copyFailures++;
      error(`Could not copy ${path.basename(fontFile)}: ${err.message}`);
      return;
    }
    try {
      registerFontInWindowsRegistry(destPath);
      installedCount++;
      info(`Installed ${color.info(path.basename(fontFile))} for the current user.`);
    } catch (err) {
      warn(`Could not register ${path.basename(fontFile)} in the registry: ${err.message.split('\n')[0]}`);
    }
  });

  if (installedCount === fontFiles.length) {
    done(`Installed ${installedCount} font file(s) for the current user in ${color.info(targetDir)}.`);
    return targetDir;
  }
  if (installedCount > 0) {
    warn(`Only ${installedCount} of ${fontFiles.length} font(s) were installed for the current user. Trying system-wide installation...`);
    return installFontsOnWindowsSystemWide(fontsDirPath, scriptDir);
  }

  if (copyFailures === fontFiles.length) {
    warn('Could not copy fonts to the user font directory.');
    return installFontsOnWindowsSystemWide(fontsDirPath, scriptDir);
  }

  // Fonts were copied but none could be registered: per-user registration is likely unsupported (Windows < 10 1809)
  warn('Per-user font registration failed. Falling back to system-wide installation...');
  return installFontsOnWindowsSystemWide(fontsDirPath, scriptDir);
};

/**
 * Install extracted font files for the current platform
 *
 * @param {string} name the exact font name
 * @param {string} fontsSourceDir directory which contains *.ttf and/or *.otf files
 * @param {string} workDir scratch directory for installer scripts; removed after install
 * @returns {Promise<boolean>} whether installation completed successfully
 */
const installFonts = async function (name, fontsSourceDir, workDir) {
  info(`Installing font ${color.info(name)} from ${color.info(fontsSourceDir)}`);
  const fontFiles = collectFontFiles(fontsSourceDir);
  let installed = false;
  if (isMacOS) {
    installed = installFontsOnMacOS(fontsSourceDir) > 0;
  } else if (isLinux) {
    installed = await installFontsOnLinux(fontsSourceDir) > 0;
  } else if (isWindows) {
    installed = await installFontsOnWindows(fontsSourceDir, workDir);
  } else {
    throw new Error(`Unsupported OS (${platform})! Please install fonts manually from ${fontsSourceDir}.`);
  }
  if (!installed) throw new Error('Installation failed: no font files were installed.');
  rmdir(workDir);

  const installedDir = isMacOS ? userFontsDirMacOS : isLinux ? userFontsDirLinux : installed;
  done(`Installation summary: ${name}\nInstalled files: ${fontFiles.length}\nLocation: ${installedDir}\n${fontFiles.map(file => '  - ' + path.basename(file)).sort().join('\n')}`);
  return true;
};
