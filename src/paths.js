import os from 'os';
import path from 'path';

export const platform = os.platform();

export const isWindows = platform === 'win32';

export const isMacOS = platform === 'darwin';

export const isLinux = platform === 'linux';

export const home = os.homedir();
export const userFontsDirMacOS = path.join(home, 'Library', 'Fonts');
export const userFontsDirLinux = path.join(home, '.local', 'share', 'fonts');
export const ggfontsDir = isWindows ? path.join(home, 'AppData', 'Local', 'ggfonts') : path.join(home, '.ggfonts');
