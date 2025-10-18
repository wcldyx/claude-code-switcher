const chalk = require('chalk');
const inquirer = require('inquirer');
const { EscNavigationManager } = require('../navigation/EscNavigationManager');
const { Logger } = require('../utils/logger');

const ESC_CANCELLED_ERROR_CODE = 'ESC_CANCELLED';

class BaseCommand {
  constructor(options = {}) {
    const input = options.input || process.stdin;
    this.escManager = new EscNavigationManager(input);
    this.activePrompt = null;
  }

  isEscCancelled(error) {
    return Boolean(error && error.code === ESC_CANCELLED_ERROR_CODE);
  }

  async prompt(questions) {
    const promptPromise = inquirer.prompt(questions);
    let settled = false;

    return await new Promise((resolve, reject) => {
      const cleanup = () => {
        if (this.activePrompt && this.activePrompt.promise === promptPromise) {
          this.activePrompt = null;
        }
      };

      const cancel = () => {
        if (settled) {
          return;
        }
        settled = true;
        if (promptPromise.ui && typeof promptPromise.ui.close === 'function') {
          promptPromise.ui.close();
        }
        cleanup();
        const error = new Error('操作已通过 ESC 取消');
        error.code = ESC_CANCELLED_ERROR_CODE;
        reject(error);
      };

      this.activePrompt = {
        promise: promptPromise,
        cancel
      };

      promptPromise
        .then((answers) => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(answers);
        })
        .catch((error) => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          reject(error);
        });
    });
  }

  cancelActivePrompt() {
    if (this.activePrompt && typeof this.activePrompt.cancel === 'function') {
      this.activePrompt.cancel();
    }
  }

  createESCListener(callback, returnMessage = '返回上级菜单', options = {}) {
    if (!this.escManager || !this.escManager.isSupported()) {
      return null;
    }

    const handler = this.escManager.register({
      once: options.once !== false,
      postDelay: typeof options.postDelay === 'number' ? options.postDelay : undefined,
      onTrigger: () => {
        this.cancelActivePrompt();
        this.clearScreen();
        if (returnMessage) {
          console.log(chalk.yellow(`🔙 ESC键 - ${returnMessage}`));
          console.log();
        }

        if (typeof callback === 'function') {
          const delay = typeof options.callbackDelay === 'number' ? options.callbackDelay : 50;
          setTimeout(() => {
            try {
              const result = callback();
              if (result && typeof result.catch === 'function') {
                result.catch((error) => {
                  if (!this.isEscCancelled(error)) {
                    Logger.error(`ESC回退回调执行失败: ${error.message}`);
                  }
                });
              }
            } catch (error) {
              if (!this.isEscCancelled(error)) {
                Logger.error(`ESC回退回调执行失败: ${error.message}`);
              }
            }
          }, delay);
        }
      }
    });

    return handler;
  }

  clearScreen() {
    if (process.platform === 'win32') {
      process.stdout.write('\x1b[2J\x1b[0f');
    } else {
      process.stdout.write('\x1b[2J\x1b[H');
    }
  }

  removeESCListener(listener) {
    if (!listener || !this.escManager) {
      return;
    }

    this.escManager.unregister(listener);
  }

  cleanupAllListeners() {
    if (this.escManager) {
      this.escManager.reset();
    }
  }

  async handleError(error, context) {
    if (this.isEscCancelled(error)) {
      return;
    }
    Logger.error(`${context}失败: ${error.message}`);
    throw error;
  }

  async safeExecute(operation, context = '操作') {
    try {
      return await operation();
    } catch (error) {
      await this.handleError(error, context);
    } finally {
      this.cleanupAllListeners();
    }
  }

  destroy() {
    this.cleanupAllListeners();
  }
}

module.exports = { BaseCommand, ESC_CANCELLED_ERROR_CODE };
