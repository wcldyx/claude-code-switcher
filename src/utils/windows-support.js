const supportsColor = require('supports-color');
const chalk = require('chalk');

class WindowsSupport {
  static detectTerminalCapabilities() {
    return {
      colors: supportsColor.stdout,
      unicode: process.env.WT_SESSION || process.env.TERM_PROGRAM === 'vscode',
      encoding: process.stdout.getColorDepth ? process.stdout.getColorDepth() > 1 : false
    };
  }

  static formatMessage(message, type = 'info') {
    const capabilities = this.detectTerminalCapabilities();
    
    if (!capabilities.colors) {
      const symbols = {
        success: '[OK]',
        error: '[错误]',
        warning: '[警告]',
        info: '[信息]'
      };
      return `${symbols[type]} ${message}`;
    }
    
    const colorMap = {
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow,
      info: chalk.blue
    };
    
    const symbols = capabilities.unicode ? 
      { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' } :
      { success: '[OK]', error: '[ERROR]', warning: '[WARN]', info: '[INFO]' };
      
    return colorMap[type](`${symbols[type]} ${message}`);
  }

  static getConfigPath() {
    const os = require('os');
    const path = require('path');
    return path.join(os.homedir(), '.cc-config.json');
  }

  static async executeWithEnv(config) {
    const spawn = require('cross-spawn');
    
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        ANTHROPIC_BASE_URL: config.baseUrl,
        ANTHROPIC_AUTH_TOKEN: config.authToken
      };

      const child = spawn('claude', [], {
        stdio: 'inherit',
        env,
        shell: true
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Claude Code 退出，代码: ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  static createBatchScript(config) {
    const commands = [
      `@echo off`,
      `set ANTHROPIC_BASE_URL=${config.baseUrl}`,
      `set ANTHROPIC_AUTH_TOKEN=${config.authToken}`,
      `echo 环境变量已设置，正在启动 Claude Code...`,
      `claude`,
      `echo Claude Code 已退出`
    ];
    
    return commands.join('\r\n');
  }
}

module.exports = { WindowsSupport };