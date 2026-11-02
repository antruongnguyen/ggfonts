import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec, execFileSync, spawn } from 'child_process';
import { fontExts, emptyStr, mkdir, mkfile, readfile, copyFiles, collectFontFiles, rmdir } from './filesystem.js';
import { platform, isWindows, isMacOS, isLinux, home, userFontsDirMacOS, userFontsDirLinux } from './paths.js';
import log from './log.js';

const { info, warn, error, done, color } = log;

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
 * Install downloaded font files for the current platform
 *
 * @param {string} name the exact font name
 * @param {string} fontsSourceDir directory which contains *.ttf and/or *.otf files
 * @param {string} workDir scratch directory for installer scripts; removed after install
 * @returns {Promise<boolean>} whether installation completed successfully
 */
export const installFonts = async function (name, fontsSourceDir, workDir) {
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
