import {
  searchFont
} from "../utilities/fs_utility.js";
import {
  arg,
  cmd,
  opt
} from '../utilities/commander_utility.js';

const _action = (name, options) => {
  searchFont(name, options.max);
};

const _args = [
  arg('<name>', 'font name.')
];

const _options = [
  opt('-m, --max <result>', 'Max result limit', 10)
];

export default cmd('search', 'Search font.', _args, _options, _action);
