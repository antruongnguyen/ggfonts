import {
  configApiKey,
  removeApiKey
} from "../utilities/fs_utility.js";
import {
  cmd,
  opt
} from '../utilities/commander_utility.js';
import log from "../utilities/console_utility.js";

const {
  info,
  warn,
  color
} = log;

const _action = (options) => {
  if (options.key) {
    configApiKey(options.key);
  } else {
    warn('No API key provided, a pre-downloaded Google Fonts metadata will be used.');
    removeApiKey();
  }
  info(`You may need to update the metadata by executing "${color.info('gfonts update')}".`);
};

const _args = [];

const _options = [
  opt('-k, --key <key>', 'API Key')
];

export default cmd('config', 'Config Google Fonts API Key. If no API key provided, a pre-downloaded Google Fonts metadata will be used.', _args, _options, _action);
