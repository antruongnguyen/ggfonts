import {
  searchFont
} from "../utilities/fs_utility.js";
import {
  arg,
  cmd,
  opt
} from '../utilities/commander_utility.js';
import log from '../utilities/console_utility.js';

const {
  warn
} = log;

const _action = (name, options) => {
  const parsedMax = Number.parseInt(options.max, 10);
  const max = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 10;
  if (max !== parsedMax) {
    warn(`Invalid max result limit "${options.max}", using default of ${max}.`);
  }
  searchFont(name, max);
};

const _args = [
  arg('<name>', 'font name.')
];

const _options = [
  opt('-m, --max <result>', 'Max result limit', 10)
];

export default cmd('search', 'Search font.', _args, _options, _action);
