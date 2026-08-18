const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function currentLevel(env = process.env) {
  return LEVELS[(env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;
}

function log(level, msg, meta = {}) {
  if (LEVELS[level] < currentLevel()) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };
  // Never log secret values (api keys, authorization headers).
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};
