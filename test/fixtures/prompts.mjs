const answers = JSON.parse(process.env.GGFONTS_ANSWERS);
const answer = async options => {
  console.log(options.message);
  if (!answers.length) throw new Error('Unexpected prompt');
  const response = answers.shift();
  if (response === '__CANCEL__') return Symbol.for('cancel');
  return response === '__DEFAULT__' ? options.initialValue : response;
};
export const autocomplete = answer;
export const confirm = answer;
export const isCancel = value => typeof value === 'symbol';
export const intro = console.log;
export const cancel = console.log;
export const log = { info: console.log, message: console.log, warn: console.log, error: console.log, success: console.log };
export const spinner = () => ({
  start: console.log, stop: console.log, message: () => {}, error: console.log
});
export const taskLog = ({ title }) => {
  console.log(title);
  const messages = [];
  return {
    message: msg => messages.push(msg),
    success: (msg, { showLog } = {}) => {
      console.log(msg);
      if (showLog) console.log(messages.join('\n'));
    },
    error: msg => { console.log(msg); console.log(messages.join('\n')); }
  };
};
