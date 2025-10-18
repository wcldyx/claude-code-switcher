const supportsColor = require('supports-color');
const chalk = require('chalk');

function detectTerminalCapabilities() {
  return {
    colors: supportsColor.stdout,
    unicode: Boolean(process.env.WT_SESSION || process.env.TERM_PROGRAM === 'vscode'),
    colorDepth: typeof process.stdout.getColorDepth === 'function' ? process.stdout.getColorDepth() : 1
  };
}

function formatMessage(message, type = 'info') {
  const capabilities = detectTerminalCapabilities();

  if (!capabilities.colors) {
    const symbols = {
      success: '[OK]',
      error: '[错误]',
      warning: '[警告]',
      info: '[信息]'
    };
    return `${symbols[type] || '[信息]'} ${message}`;
  }

  const colorMap = {
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    info: chalk.blue
  };

  const symbols = capabilities.unicode
    ? { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }
    : { success: '[OK]', error: '[ERROR]', warning: '[WARN]', info: '[INFO]' };

  const formatter = colorMap[type] || colorMap.info;
  const symbol = symbols[type] || symbols.info;
  return formatter(`${symbol} ${message}`);
}

module.exports = { formatMessage };
