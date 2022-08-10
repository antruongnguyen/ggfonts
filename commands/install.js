import {
  downloadFont
} from "../utilities/fs_utility.js";
import {
  arg,
  cmd,
  opt
} from '../utilities/commander_utility.js';
import log from "../utilities/console_utility.js";


const _action = (name) => {
  downloadFont(name);
};

const _args = [
  arg('<name>', 'exact font name.')
];

const _options = [

];

export default cmd('install', 'Install font.', _args, _options, _action);
