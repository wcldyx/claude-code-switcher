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

  static async executeWithEnv(config, launchArgs = []) {
    const spawn = require('cross-spawn');
    
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env
      };

      // 根据认证模式设置不同的环境变量
      if (config.authMode === 'oauth_token') {
        env.CLAUDE_CODE_OAUTH_TOKEN = config.authToken;
      } else if (config.authMode === 'api_key') {
        env.ANTHROPIC_BASE_URL = config.baseUrl;
        env.ANTHROPIC_API_KEY = config.authToken;
      } else {
        // auth_token 模式或默认模式
        env.ANTHROPIC_BASE_URL = config.baseUrl;
        env.ANTHROPIC_AUTH_TOKEN = config.authToken;
      }

      // 模型环境变量
      if (config.models && config.models.primary) {
        env.ANTHROPIC_MODEL = config.models.primary;
      }
      if (config.models && config.models.smallFast) {
        env.ANTHROPIC_SMALL_FAST_MODEL = config.models.smallFast;
      }

      const args = [...launchArgs];
      const child = spawn('claude', args, {
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

  static createBatchScript(config, launchArgs = []) {
    const commands = [`@echo off`];
    
    // 根据认证模式设置不同的环境变量
    if (config.authMode === 'oauth_token') {
      commands.push(`set CLAUDE_CODE_OAUTH_TOKEN=${config.authToken}`);
    } else if (config.authMode === 'api_key') {
      commands.push(`set ANTHROPIC_BASE_URL=${config.baseUrl}`);
      commands.push(`set ANTHROPIC_API_KEY=${config.authToken}`);
    } else {
      // auth_token 模式或默认模式
      commands.push(`set ANTHROPIC_BASE_URL=${config.baseUrl}`);
      commands.push(`set ANTHROPIC_AUTH_TOKEN=${config.authToken}`);
    }
    
    // 模型环境变量
    if (config.models && config.models.primary) {
      commands.push(`set ANTHROPIC_MODEL=${config.models.primary}`);
    }
    if (config.models && config.models.smallFast) {
      commands.push(`set ANTHROPIC_SMALL_FAST_MODEL=${config.models.smallFast}`);
    }
    
    commands.push(`echo 环境变量已设置，正在启动 Claude Code...`);
    commands.push(`claude ${launchArgs.join(' ')}`);
    commands.push(`echo Claude Code 已退出`);
    
    return commands.join('\r\n');
  }
}

module.exports = { WindowsSupport };