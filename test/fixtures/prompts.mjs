const answers = JSON.parse(process.env.GGFONTS_ANSWERS);
const answer = async options => {
  console.log(options.message);
  if (!answers.length) throw new Error('Unexpected prompt');
  const response = answers.shift();
  if (response === '__CANCEL__') return Symbol.for('cancel');
  const value = response === '__EMPTY__' ? undefined : response;
  const problem = options.validate && options.validate(value);
  if (problem) {
    console.log(problem);
    return answer(options);
  }
  return value;
};
export const select = answer;
export const autocomplete = answer;
export const confirm = answer;
export const password = answer;
export const text = answer;
export const isCancel = value => typeof value === 'symbol';
export const intro = console.log;
export const outro = console.log;
export const cancel = console.log;
export const note = console.log;
export const log = { info: console.log, message: console.log, warn: console.log, error: console.log, success: console.log };
export const spinner = () => ({
  start: console.log, stop: console.log, message: () => {},
  clear: () => {}, error: console.log, cancel: console.log
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
