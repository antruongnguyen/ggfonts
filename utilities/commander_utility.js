export const opt = function (_flags, _desc, _defaultValue) {
  const o = {
    flags: _flags,
    description: _desc
  };

  if (_defaultValue !== undefined && _defaultValue !== null) {
    o.defaultValue = _defaultValue;
    o.description = o.description;
  }

  return o;
}

export const arg = function (_name, _desc, _defaultValue) {
  const a = {
    name: _name,
    description: _desc
  };

  if (_defaultValue !== undefined && _defaultValue !== null) {
    a.defaultValue = _defaultValue;
    a.description = a.description;
  }

  return a;
}

export const cmd = function (_name, _desc, _args, _options, _action) {
  return {
    command: _name,
    description: _desc,
    args: _args,
    options: _options,
    action: _action
  };
};

// void function
export const defineCommand = function (_cli, _cmd) {
  const {
    command,
    description,
    args,
    options,
    action
  } = _cmd;
  let cmd = _cli
    .command(command)
    .description(description)
    .action(action);

  if (args) {
    args.forEach(_arg => {
      cmd.argument(_arg.name, _arg.description, _arg.defaultValue);
    });
  }

  if (options) {
    options.forEach(_opt => {
      cmd.option(_opt.flags, _opt.description, _opt.defaultValue);
    });
  }
}
