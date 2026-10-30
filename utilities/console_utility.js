import {
  info,
  warn,
  error
} from 'console';
import pc from 'picocolors';

let reporter;

const _label = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  done: 'DONE',
};

const _color = {
  cyan: pc.cyan,
  yellow: pc.yellow,
  red: pc.red,
  green: pc.green
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
  if (reporter) return reporter.info(data ? `${msg} ${data}` : msg);
  if (data) {
    info(_prefix.info, msg, data);
  } else {
    info(_prefix.info, msg);
  }
};

const _warn = function (msg, data) {
  if (reporter) return reporter.warn(data ? `${msg} ${data}` : msg);
  if (data) {
    warn(_prefix.warn, msg, data);
  } else {
    warn(_prefix.warn, msg);
  }
};

const _error = function (msg, data) {
  if (reporter) return reporter.error(data ? `${msg} ${data}` : msg);
  if (data) {
    error(_prefix.error, msg, data);
  } else {
    error(_prefix.error, msg);
  }
};

const log = {
  setReporter: (value) => { reporter = value; },
  info: _info,
  warn: _warn,
  error: _error,
  done: (msg = 'Done!') => reporter ? reporter.success(msg) : info(_prefix.success, msg),
  color: {
    info: _color.cyan,
    warn: _color.yellow,
    error: _color.red,
    success: _color.green
  }
};

export default log;
