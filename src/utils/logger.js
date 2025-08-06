const chalk = require('chalk');
const { WindowsSupport } = require('./windows-support');

class Logger {
  static info(message) {
    console.log(WindowsSupport.formatMessage(message, 'info'));
  }

  static success(message) {
    console.log(WindowsSupport.formatMessage(message, 'success'));
  }

  static warning(message) {
    console.log(WindowsSupport.formatMessage(message, 'warning'));
  }

  static error(message) {
    console.error(WindowsSupport.formatMessage(message, 'error'));
  }

  static debug(message) {
    if (process.env.DEBUG) {
      console.log(WindowsSupport.formatMessage(`[DEBUG] ${message}`, 'info'));
    }
  }

  static step(message) {
    console.log(WindowsSupport.formatMessage(`🔄 ${message}`, 'info'));
  }

  static complete(message) {
    console.log(WindowsSupport.formatMessage(`✅ ${message}`, 'success'));
  }

  static fatal(message) {
    console.error(WindowsSupport.formatMessage(`💀 ${message}`, 'error'));
    process.exit(1);
  }
}

module.exports = { Logger };