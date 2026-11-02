import fs from 'fs';
import path from 'path';
import FuzzySearch from 'fuzzy-search';
import { download, fetchGoogleFontsJson } from './download.js';
import { arrayOf, fontExts, getFileExt, mkdir, rmdir } from './filesystem.js';
import { ggfontsDir } from './paths.js';
import { installFonts } from './install.js';
import log from './log.js';

const { info, error, color } = log;

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
    const json = await fetchGoogleFontsJson(url);
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
 * Uses the Google Fonts file list endpoint to download font files.
 *
 * @param {string} name an exact font name
 * @returns {Promise<boolean>} whether installation completed
 */
export const downloadFont = async function (name) {
  const tmpDir = path.join(ggfontsDir, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const workDir = fs.mkdtempSync(path.join(tmpDir, 'font-'));

  info(`Installing font ${color.info(name)}`);
  const fontsSourceDir = await downloadFontFromFileList(name, path.join(workDir, 'fonts'));
  if (!fontsSourceDir) {
    error(`Could not download font ${color.warn(name)}. Please verify the font name and your network connection.`);
    return false;
  }

  return installFonts(name, fontsSourceDir, workDir);
}

export const searchFont = async function (name, maxResultLimit = 10) {
  const fonts = await getFonts();
  info(`Search font by keyword: ${color.info(name)}`);
  const searcher = new FuzzySearch(fonts, ['family'], {
    caseSensitive: false,
  });
  const results = searcher.search(name.trim());
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
  try {
    const url = 'https://fonts.google.com/metadata/fonts';
    info(`Fetching font catalogue: ${color.info(url)}`);
    const json = await fetchGoogleFontsJson(url);
    const families = json && json.familyMetadataList;
    if (!Array.isArray(families) || !families.every(font => font && typeof font.family === 'string' && font.family.trim())) {
      throw new Error('Invalid font catalogue. Expected font family names.');
    }
    return families.map(font => ({ family: font.family }));
  } catch (err) {
    throw new Error(`Failed to load font catalogue: ${err.message}`);
  }
};
