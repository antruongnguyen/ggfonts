import {
  updateGoogleFontsMeta
} from "../utilities/fs_utility.js";
import {
  cmd
} from '../utilities/commander_utility.js';

const _action = () => {
  updateGoogleFontsMeta();
};

const _args = [];

const _options = [];

export default cmd('update', 'Update Google Fonts metadata.', _args, _options, _action);
