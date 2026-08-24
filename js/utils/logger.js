/**
 * 自研轻量分级日志（无第三方依赖）。
 * 格式统一：时间戳 | 级别 | 模块 | 事件 | 数据(JSON)
 * 生产环境默认 warn+error；开发环境可全开（setLogLevel）。
 * 禁止打印敏感信息（房间码之外的凭据、token 等）。
 */

export const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLevel = LOG_LEVELS.info;

/** 设置全局日志级别，例如 setLogLevel('debug') */
export function setLogLevel(level) {
  if (typeof level === 'string') {
    const key = level.toLowerCase();
    if (key in LOG_LEVELS) {
      currentLevel = LOG_LEVELS[key];
      return;
    }
  }
  if (typeof level === 'number' && level >= 0 && level <= 3) {
    currentLevel = level;
  }
}

export function getLogLevel() {
  return currentLevel;
}

function format(level, module, event, data) {
  const ts = new Date().toISOString();
  let dataStr = '';
  if (data !== undefined) {
    try {
      dataStr = ' | ' + JSON.stringify(data);
    } catch {
      dataStr = ' | [unserializable]';
    }
  }
  return `${ts} | ${level} | ${module} | ${event}${dataStr}`;
}

function write(level, module, event, data) {
  if (LOG_LEVELS[level] < currentLevel) return;
  const line = format(level, module, event, data);
  // 浏览器与 Node 均可用；error 走 console.error，其余走 console.log
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (module, event, data) => write('debug', module, event, data),
  info: (module, event, data) => write('info', module, event, data),
  warn: (module, event, data) => write('warn', module, event, data),
  error: (module, event, data) => write('error', module, event, data),
};
