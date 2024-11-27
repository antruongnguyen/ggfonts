import os from 'os';
import fs from 'fs';
import path from 'path';
import https from 'https';
import {
  exec,
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
const downloadsDir = path.join(home, 'Downloads');
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
 * Get the name of file or directory from a path
 *
 * @param {string} _path a path to evaluate
 * @returns {string} the name of file or directory
 */
const getBaseName = (_path) => path.basename(_path);

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
  copyFileExtensions = arrayOf(copyFileExtensions);
  fs.readdirSync(fromDirPath)
    .filter(fileName => copyFileExtensions.length === 0 ? true : containsAny(getFileExt(fileName), copyFileExtensions))
    .forEach(fileName => {
      const _fromPath = path.join(fromDirPath, fileName);
      const _toPath = path.join(toDirPath, fileName);
      if (isFile(_fromPath)) {
        info(`Copy ${color.info(_fromPath)} to ${color.info(toDirPath)}`);
        fs.copyFileSync(_fromPath, _toPath);
        return;
      }
      copyFiles(_fromPath, _toPath, copyFileExtensions);
    });
}

/**
 * Construct download file path
 *
 * @param {string} name the file name
 * @returns Absolute path of ~/Downloads/[name]
 */
const downloadFontFilePath = function (name) {
  return path.join(downloadsDir, name);
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

const _download = function (_url, _toFile, _onSuccess = (response) => {}, _onError = (err) => {}) {
  const request = https.get(_url, function (response) {
    const {
      statusCode,
      headers
    } = response;
    if (statusCode === 302 || statusCode === 301) {
      info(`[${response.statusCode} - ${response.statusMessage}] Redirecting to ${headers.location}`);
      _download(headers.location, _toFile, _onSuccess, _onError);
    } else {
      _onSuccess(response);
    }
  });

  request.on('error', _onError);
}

export const download = function (_url, savingFilePath, callback = () => {}) {
  info('Downloading', color.info(_url));
  const tmp = savingFilePath + '.tmp';
  const _toFile = fs.createWriteStream(tmp);
  const _onSuccess = function (response) {
    const {
      statusCode,
      statusMessage
    } = response;
    if (statusCode !== 200) {
      error(`[${statusCode} - ${statusMessage}] See https://httpstatusof.web.app/${statusCode}`);
      _toFile.close();
      fs.unlinkSync(tmp);
      if (contains(_url, 'www.googleapis.com')) {
        error('Invalid Google Fonts API Key!');
      }
      info(`In case you configured an invalid Google Fonts API Key, you could remove ${color.info(apiKeyFilePath)} file or create a new Key by following the instructions at https://developers.google.com/fonts/docs/developer_api`);
      return;
    }
    response.pipe(_toFile);
    _toFile.on('finish', () => {
      _toFile.close();
      fs.copyFileSync(tmp, savingFilePath);
      fs.unlinkSync(tmp);
      info('Downloaded to', color.info(savingFilePath));
      callback();
    });
  }

  _download(_url, _toFile, _onSuccess, (err) => {
    error(err);
  });
}

/**
 * Download and install a font by provided name from Google Fonts
 *
 * @param {string} name an exact font name
 * @returns {void}
 */
export const downloadFont = function (name) {
  ensureDataExists(function () {
    const version = getFontVersion(name);
    if (version === '') {
      warn(`No font found with name: ${color.warn(name)}`);
      searchFont(name);
      return;
    }
    mkdir(downloadsDir);
    const safeName = name.replaceAll(' ', '\\ ');
    const filePath = downloadFontFilePath(`${safeName}-${version}.zip`);
    download(`https://fonts.google.com/download?family=${name}`, filePath, () => installFonts(safeName, filePath));
  });
}

export const updateGoogleFontsMeta = function (callback = () => {}) {
  mkdir(ggfontsDir);
  download(googleFontsMetaUrl(), googleFontsFilePath, function () {
    const jsonText = readfile(googleFontsFilePath);
    const metaContent = JSON.stringify({
      items: JSON.parse(jsonText).items.map(item => Object.assign({}, {
        family: item.family,
        version: item.version
      }))
    });
    info(`Optimize and minify the metadata ${color.info(googleFontsFilePath)} to ${color.info(googleFontMinFilePath)}`);
    mkfile(googleFontMinFilePath, metaContent);
    done('Updated Google Font metadata!');
    callback();
  });
}

export const configApiKey = function (apiKey) {
  mkfile(apiKeyFilePath, apiKey);
  info(`API Key ${color.info(apiKey)} is saved to ${color.info(apiKeyFilePath)}`);
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

export const searchFont = function (name, maxResultLimit = 10) {
  ensureDataExists(function () {
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
  });
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

const ensureDataExists = function (callback = () => {}) {
  if (exists(googleFontMinFilePath)) {
    callback();
    return;
  }
  warn('No local data found! Updating Google Fonts metadata...');
  updateGoogleFontsMeta(callback);
}

const readZipFile = (zipFilePath) => new AdmZip(zipFilePath);

/**
 * Extract (unzip) a zip file
 *
 * @param {string} zipFilePath a zip file path
 * @param {string} extractDirPath a directory path to unzip
 * @param {string[]} extractFileExtensions an optional filter for decompression. Leave it empty to extract all.
 * @returns {void} no return
 */
const extractZipFile = function (zipFilePath, extractDirPath, extractFileExtensions = []) {
  const zipFile = readZipFile(zipFilePath);

  extractFileExtensions = arrayOf(extractFileExtensions);

  // Ensure the dir exists
  mkdir(extractDirPath);

  if (extractFileExtensions.length === 0) {
    zipFile.extractAllTo(extractDirPath, true);
    return;
  }

  zipFile.getEntries().forEach(function (zipEntry) {
    if (containsAny(getFileExt(zipEntry.entryName), extractFileExtensions)) {
      zipFile.extractEntryTo(zipEntry.entryName, extractDirPath, false, true);
      info('[Extracted]', color.info(zipEntry.entryName));
    }
  });
};

const installFontsOnMacOS = (fontsDirPath) => {
  copyFiles(fontsDirPath, userFontsDirMacOS, fontExts);
};

/**
 * Install fonts for supported Linux distros (Debian-based OS, Arch-based OS, CentOS, Alpine, and Fedora)
 *
 * @param {string} fontsDirPath a directory which contains *.ttf and/or *.otf files
 */
const installFontsOnLinux = (fontsDirPath) => {
  const uname = os.version().toLowerCase();

  // Debian-based
  if (containsAny(uname, ['ubuntu', 'mint', 'pop!', ' mx ', 'debian'])) {
    // Install location: ~/.local/share/fonts (or ~/.fonts)
    copyFiles(fontsDirPath, userFontsDirLinux, fontExts);
    info(`Executing command ${color.info('fc-cache')} to update the Font Cache.`);
    exec("fc-cache", (error, stdout, stderr) => {
      if (error) {
        error(error.message);
        return;
      }
      if (stderr) {
        error(stderr);
        return;
      }
      info(stdout);
    });
    return;
  }

  // Arch-based OS
  if (containsAny(uname, ['manjaro', 'endeavouros', 'arch'])) {
    // Install location: ~/.local/share/fonts
    copyFiles(fontsDirPath, userFontsDirLinux, fontExts);
    return;
  }

  // CentOS and Alpine
  if (containsAny(uname, ['centos', 'alpine'])) {
    // Install location: ~/.fonts
    copyFiles(fontsDirPath, path.join(home, '.fonts'), fontExts);
    return;
  }

  // Fedora
  if (contains(uname, 'fedora')) {
    // Install location: /usr/share/fonts/[Font Family]
    copyFiles(fontsDirPath, path.join('usr', 'share', 'fonts', getBaseName(fontsDirPath)), fontExts);
    return;
  }

  warn(`Unsuported Linux distro found! Please install fonts manually from ${extractDirPath}.`);
};

const installFontsOnWindows = (fontsDirPath) => {
  // https://superuser.com/questions/201896/how-do-i-install-a-font-from-the-windows-command-prompt
  const installScriptPath = path.join(fontsDirPath, 'install.ps1');
  mkfile(installScriptPath, [
    `cd '${fontsDirPath}'`,
    '$fonts = (New-Object -ComObject Shell.Application).Namespace(0x14)',
    'Get-ChildItem -Recurse -include *.*tf | % { $fonts.CopyHere($_.fullname) }'
  ].join(os.EOL));

  const powershell = spawn("powershell.exe", [installScriptPath]);
  powershell.stdout.on("data", function (data) {
    info("[PowerShell]", data);
  });

  powershell.stderr.on("data", function (data) {
    error("[PowerShell]", data);
  });

  powershell.on("exit", function () {
    info("[PowerShell] Done!");
  });

  powershell.stdin.end();

  info(`[Notice] The tool tried to install the fonts by executing '${installScriptPath}'. If any error occured, please install the fonts manually by copying fonts from '${fontsDirPath}' to 'C:\\Windows\\Fonts'`);
};

const installFonts = function (name, filePath) {
  info(os.version());
  let extractDirPath = path.join(downloadsDir, name);

  info(`Extracting file ${color.info(filePath)} to ${color.info(extractDirPath)}`);
  extractZipFile(filePath, extractDirPath, fontExts.concat(['txt']));

  info('Installing fonts...');
  if (isMacOS) {
    installFontsOnMacOS(extractDirPath);
  } else if (isLinux) {
    installFontsOnLinux(extractDirPath);
  } else if (isWindows) {
    installFontsOnWindows(extractDirPath);
  } else {
    warn(`Unsuported OS found! Please install fonts manually from ${extractDirPath}.`);
  }

  done();
};
