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

const require = createRequire(import.meta.url);
const { version } = require('./package.json');

const cli = new Command();

cli.version(version, '-v, --version', 'display version number');

cli.description("Google Fonts CLI tool to search and install font.");

defineCommand(cli, configCommand);

defineCommand(cli, updateCommand);

defineCommand(cli, searchCommand);

defineCommand(cli, installCommand);

cli.parse(process.argv);
