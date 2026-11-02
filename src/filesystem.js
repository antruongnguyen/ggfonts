import os from 'os';
import fs from 'fs';
import path from 'path';
import log from './log.js';

const { info, warn, error, color } = log;

export const fontExts = ['ttf', 'otf'];

export const emptyStr = '';

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
export const getFileExt = (_path) => path.extname(_path).toLowerCase();

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
export const arrayOf = (_values) => Array.isArray(_values) ? _values : [];

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
export const mkdir = function (dirPath, recursive = true) {
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
export const mkfile = function (filePath, content = emptyStr, mode = 'w+') {
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
export const readfile = function (filePath, verbose = false) {
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
export const copyFiles = function (fromDirPath, toDirPath, copyFileExtensions = []) {
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
 * Recursively remove a directory (best effort)
 *
 * @param {string} dirPath the directory path to remove
 * @returns {void}
 */
export const rmdir = function (dirPath) {
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
export const collectFontFiles = function (dirPath) {
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
