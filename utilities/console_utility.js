import {
  info,
  warn,
  error
} from 'console';

const _label = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  done: 'DONE',
};

const _color = {
  reset: "\x1b[0m",
  cyan: (str) => `\x1b[36m${str}\x1b[0m`,
  yellow: (str) => `\x1b[33m${str}\x1b[0m`,
  red: (str) => `\x1b[31m${str}\x1b[0m`,
  green: (str) => `\x1b[32m${str}\x1b[0m`
}

const _paddingMaxLength = Math.max.apply(null, Object.values(_label).map(str => str.length)) + 2;

const _padding = (type) => `[${type}]`.padEnd(_paddingMaxLength, ' ');

const _prefix = {
  info: _color.cyan(_padding(_label.info)),
  warn: _color.yellow(_padding(_label.warn)),
  error: _color.red(_padding(_label.error)),
  success: _color.green(_padding(_label.done))
};

const _info = function (msg, data) {
  if (data) {
    info(_prefix.info, msg, data);
  } else {
    info(_prefix.info, msg);
  }
};

const _warn = function (msg, data) {
  if (data) {
    warn(_prefix.warn, msg, data);
  } else {
    warn(_prefix.warn, msg);
  }
};

const _error = function (msg, data) {
  if (data) {
    error(_prefix.error, msg, data);
  } else {
    error(_prefix.error, msg);
  }
};

const log = {
  info: _info,
  warn: _warn,
  error: _error,
  done: (msg = 'Done!') => info(_prefix.success, msg),
  color: {
    info: _color.cyan,
    warn: _color.yellow,
    error: _color.red,
    success: _color.green
  }
};

export default log;
