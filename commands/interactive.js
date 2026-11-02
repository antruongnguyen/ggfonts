import * as p from '@clack/prompts';
import pc from 'picocolors';
import { configApiKey, downloadFont, getFonts, removeApiKey, updateGoogleFontsMeta } from '../utilities/fs_utility.js';
import log from '../utilities/console_utility.js';

async function withProgress(message, successMessage, action, detailed = false) {
  const progress = detailed
    ? p.taskLog({ title: message, limit: 6, retainLog: true })
    : p.spinner({ onCancel: () => process.exit(0) });
  const cancel = () => { p.cancel('Cancelled.'); process.exit(0); };
  if (detailed) process.once('SIGINT', cancel);
  const messages = [];
  log.setReporter({
    info: msg => progress.message(msg),
    success: msg => progress.message(msg),
    warn: msg => messages.push(['warn', msg]),
    error: msg => messages.push(['error', msg])
  });
  if (!detailed) progress.start(message);
  try {
    const result = await action();
    if (result === false) throw new Error('Operation failed. See details below.');
    if (detailed) progress.success(successMessage, { showLog: true });
    else progress.stop(successMessage);
    return result;
  } catch (err) {
    progress.error(err.message);
    throw err;
  } finally {
    if (detailed) process.removeListener('SIGINT', cancel);
    log.setReporter(p.log);
    for (const [level, msg] of messages) p.log[level](msg);
  }
}

export default async function runInteractive() {
  p.intro(pc.bgCyan(pc.black(' ggfonts ')));
  log.setReporter(p.log);
  const cancelled = value => {
    if (!p.isCancel(value)) return false;
    p.cancel('Cancelled.');
    return true;
  };

  try {
    while (true) {
      const action = await p.select({
        message: 'What would you like to do?',
        options: [
          { value: 'fonts', label: 'Search and install fonts', hint: 'Browse Google Fonts' },
          { value: 'update', label: 'Update font catalogue' },
          { value: 'config', label: 'Configure API key' },
          { value: 'exit', label: 'Exit' }
        ]
      });
      if (cancelled(action)) return;
      if (action === 'exit') {
        p.outro('See you next time!');
        return;
      }

      try {
        if (action === 'fonts') {
          const fonts = await withProgress('Loading font catalogue', 'Font catalogue ready', getFonts);
          if (fonts.length === 0) {
            p.log.warn('No fonts available. Update the font catalogue and try again.');
            continue;
          }
          const family = await p.autocomplete({
            message: 'Choose a font',
            placeholder: 'Type a font name to search',
            maxItems: 8,
            validate: value => value ? undefined : 'Choose a font from the list.',
            options: fonts.map(font => ({ value: font.family, label: font.family, hint: font.version }))
          });
          if (cancelled(family)) return;
          const install = await p.confirm({ message: `Install ${pc.bold(family)} for the current user?`, initialValue: false });
          if (cancelled(install)) return;
          if (install) await withProgress(`Installing ${family}`, `${family} installed`, () => downloadFont(family), true);
        } else if (action === 'update') {
          await withProgress('Updating font catalogue', 'Font catalogue updated', updateGoogleFontsMeta);
        } else if (action === 'config') {
          const source = await p.select({
            message: 'Choose a font metadata source',
            options: [
              { value: 'default', label: 'Use the default catalogue', hint: 'No API key needed' },
              { value: 'key', label: 'Use a Google Fonts API key' }
            ]
          });
          if (cancelled(source)) return;
          if (source === 'key') {
            const key = await p.password({
              message: 'Google Fonts API key',
              validate: value => value.trim() ? undefined : 'Enter an API key.'
            });
            if (cancelled(key)) return;
            configApiKey(key.trim());
          } else {
            removeApiKey();
            p.log.success('Using the default font catalogue.');
          }
          p.log.info('Update the font catalogue to use the selected source.');
        }
      } catch (err) {
        p.log.error(err.message);
        p.log.warn('Choose another action or try again.');
      }
    }
  } finally {
    log.setReporter(undefined);
  }
}
