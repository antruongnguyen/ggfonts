import {
  Command
} from "commander";
import {
  createRequire
} from "module";
import runInteractive from './interactive.js';
import log from './log.js';
import { searchFont, downloadFont } from './fonts.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const cli = new Command();
cli.name('ggfonts');
cli.addHelpCommand();

cli.version(version, '-v, --version', 'display version number');

cli.description("Google Fonts CLI tool to search and install font.");

cli.command('search')
  .description('Search font.')
  .argument('<name>', 'font name.')
  .option('-m, --max <result>', 'Max result limit', 10)
  .action((name, options) => {
    const parsedMax = Number.parseInt(options.max, 10);
    const max = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 10;
    if (max !== parsedMax) {
      log.warn(`Invalid max result limit "${options.max}", using default of ${max}.`);
    }
    return searchFont(name, max);
  });

cli.command('install')
  .description('Install font.')
  .argument('<name>', 'exact font name.')
  .action(async name => {
    if (!await downloadFont(name)) process.exitCode = 1;
  });

cli.action(async () => {
  if (process.stdin.isTTY && process.stdout.isTTY) {
    await runInteractive();
  } else {
    cli.outputHelp();
  }
});

cli.parseAsync(process.argv).catch(err => {
  log.error(err.message);
  process.exitCode = 1;
});
