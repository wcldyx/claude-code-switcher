const chalk = require('chalk');
const { formatMessage } = require('./terminal-format');

class Logger {
  static info(message) {
    console.log(formatMessage(message, 'info'));
  }

  static success(message) {
    console.log(formatMessage(message, 'success'));
  }

  static warning(message) {
    console.log(formatMessage(message, 'warning'));
  }

  static error(message) {
    console.error(formatMessage(message, 'error'));
  }

  static debug(message) {
    if (process.env.DEBUG) {
      console.log(formatMessage(`[DEBUG] ${message}`, 'info'));
    }
  }

  static step(message) {
    console.log(formatMessage(`🔄 ${message}`, 'info'));
  }

  static complete(message) {
    console.log(formatMessage(`✅ ${message}`, 'success'));
  }

  static fatal(message) {
    console.error(formatMessage(`💀 ${message}`, 'error'));
    process.exit(1);
  }
}

module.exports = { Logger };
