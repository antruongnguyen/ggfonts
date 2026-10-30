#!/usr/bin/env node

import {
  Command
} from "commander";
import {
  createRequire
} from "module";
import {
  defineCommand
} from './utilities/commander_utility.js';
import configCommand from "./commands/config.js";
import updateCommand from "./commands/update.js";
import searchCommand from "./commands/search.js";
import installCommand from "./commands/install.js";
import runInteractive from "./commands/interactive.js";
import log from "./utilities/console_utility.js";

const require = createRequire(import.meta.url);
const { version } = require('./package.json');

const cli = new Command();
cli.name('ggfonts');
cli.addHelpCommand();

cli.version(version, '-v, --version', 'display version number');

cli.description("Google Fonts CLI tool to search and install font.");

defineCommand(cli, configCommand);

defineCommand(cli, updateCommand);

defineCommand(cli, searchCommand);

defineCommand(cli, installCommand);

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
