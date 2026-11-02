import * as p from '@clack/prompts';
import pc from 'picocolors';
import { downloadFont, getFonts } from './fonts.js';
import log from './log.js';

async function withProgress(message, successMessage, action, detailed = false) {
  let progress;
  const cancel = () => process.exit(0);
  const onExit = code => {
    if (code === 0) {
      if (!detailed) progress?.clear();
      p.outro('See you next time!');
    }
  };
  // Clack's input blocker can exit directly instead of emitting SIGINT.
  process.once('exit', onExit);
  process.once('SIGINT', cancel);
  progress = detailed
    ? p.taskLog({ title: message })
    : p.spinner({ cancelMessage: '', onCancel: cancel });
  const messages = [];
  let summary;
  log.setReporter({
    info: msg => { if (!detailed) progress.message(msg); },
    success: msg => {
      if (detailed) {
        if (msg.startsWith('Installation summary:')) summary = msg;
      } else {
        progress.message(msg);
      }
    },
    warn: msg => messages.push(['warn', msg]),
    error: msg => messages.push(['error', msg])
  });
  if (!detailed) progress.start(message);
  try {
    const result = await action();
    if (result === false) throw new Error('Operation failed. See details below.');
    if (detailed) {
      progress.success(successMessage, { showLog: false });
      if (summary) p.log.success(summary);
    } else progress.stop(successMessage);
    return result;
  } catch (err) {
    progress.error(err.message);
    throw err;
  } finally {
    process.removeListener('exit', onExit);
    process.removeListener('SIGINT', cancel);
    log.setReporter(p.log);
    for (const [level, msg] of messages) p.log[level](msg);
  }
}

export default async function runInteractive() {
  p.intro(pc.bgCyan(pc.black(' ggfonts ')));
  log.setReporter(p.log);
  const cancelled = value => {
    if (!p.isCancel(value)) return false;
    p.outro('See you next time!');
    return true;
  };

  try {
    let fonts;
    try {
      fonts = await withProgress('Loading font catalogue', 'Font catalogue ready', getFonts);
    } catch (err) {
      p.log.error(err.message);
      process.exitCode = 1;
      return;
    }
    if (fonts.length === 0) {
      p.log.warn('No fonts available. Try again later.');
      return;
    }
    while (true) {
      try {
        const family = await p.autocomplete({
          message: 'Choose a font (Esc/Ctrl+C to exit)',
          placeholder: 'Type a font name to search',
          maxItems: 8,
          validate: value => value ? undefined : 'Choose a font from the list.',
          options: fonts.map(font => ({ value: font.family, label: font.family }))
        });
        if (cancelled(family)) return;
        const install = await p.confirm({ message: `Install ${pc.bold(family)} for the current user?`, initialValue: true });
        if (cancelled(install)) return;
        if (install) await withProgress(`Installing ${family}`, `${family} installed`, () => downloadFont(family), true);
      } catch (err) {
        p.log.error(err.message);
        p.log.warn('Choose another font or press Esc/Ctrl+C to exit.');
      }
    }
  } finally {
    log.setReporter(undefined);
  }
}
