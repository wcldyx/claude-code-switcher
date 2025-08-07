const inquirer = require('inquirer');
const chalk = require('chalk');
const readline = require('readline');
const { ConfigManager } = require('../config');
const { validator } = require('../utils/validator');
const { Logger } = require('../utils/logger');
const { UIHelper } = require('../utils/ui-helper');

class ProviderAdder {
  constructor() {
    this.configManager = new ConfigManager();
  }

  // 创建 ESC 键监听器
  createESCListener(callback, returnMessage = '返回上级菜单') {
    if (process.stdin.setRawMode) {
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      
      let escTimeout = null;
      
      const listener = (str, key) => {
        if (key.name === 'escape') {
          // 清除之前的超时
          if (escTimeout) {
            clearTimeout(escTimeout);
          }
          
          // 设置超时来区分真正的ESC键和其他组合键
          escTimeout = setTimeout(() => {
            process.stdin.setRawMode(false);
            process.stdin.removeListener('keypress', listener);
            
            // 清理屏幕并显示返回信息
            this.clearScreen();
            console.log(chalk.yellow(`🔙 ESC键 - ${returnMessage}`));
            console.log();
            
            if (callback) {
              // 使用setTimeout让界面切换更流畅
              setTimeout(callback, 50);
            }
          }, 30); // 30ms延迟，优化响应速度
        } else if (escTimeout) {
          // 如果是其他键，清除ESC超时（表示是组合键）
          clearTimeout(escTimeout);
          escTimeout = null;
        }
      };
      
      process.stdin.on('keypress', listener);
      
      // 返回一个包含超时的监听器对象
      return {
        listener,
        cleanup: () => {
          if (escTimeout) {
            clearTimeout(escTimeout);
          }
          process.stdin.setRawMode(false);
          process.stdin.removeListener('keypress', listener);
        }
      };
    } else {
      // 在不支持 setRawMode 的环境中，返回空的监听器
      return null;
    }
  }

  // 清理屏幕
  clearScreen() {
    // 使用更可靠的清屏方法
    if (process.platform === 'win32') {
      process.stdout.write('\x1b[2J\x1b[0f');
    } else {
      process.stdout.write('\x1b[2J\x1b[H');
    }
  }

  // 移除 ESC 键监听器
  removeESCListener(listener) {
    if (listener && process.stdin.setRawMode) {
      if (typeof listener === 'object' && listener.cleanup) {
        // 新的监听器对象，使用cleanup方法
        listener.cleanup();
      } else {
        // 旧的监听器函数（保持向后兼容）
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', listener);
      }
    }
  }

  async interactive() {
    console.log(UIHelper.createTitle('添加新供应商', UIHelper.icons.add));
    console.log();
    console.log(UIHelper.createTooltip('选择供应商类型或手动配置'));
    console.log();
    
    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('取消添加供应商');
      // 返回供应商选择界面
      const { switchCommand } = require('./switch');
      switchCommand();
    }, '取消添加');

    try {
      // 首先选择是否使用预设配置
      const typeAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'providerType',
          message: '选择供应商类型:',
          choices: [
            { name: '🔒 官方 Claude Code (OAuth)', value: 'official_oauth' },
            { name: '⚙️ 自定义配置', value: 'custom' }
          ],
          default: 'custom'
        }
      ]);

      // 移除 ESC 键监听
      this.removeESCListener(escListener);

      if (typeAnswer.providerType === 'official_oauth') {
        return await this.addOfficialOAuthProvider();
      } else {
        return await this.addCustomProvider();
      }
    } catch (error) {
      // 移除 ESC 键监听
      this.removeESCListener(escListener);
      throw error;
    }
  }

  async addOfficialOAuthProvider() {
    console.log(UIHelper.createTitle('添加官方 OAuth 供应商', UIHelper.icons.add));
    console.log();
    console.log(UIHelper.createTooltip('配置官方 Claude Code OAuth 认证'));
    console.log();
    
    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('取消添加供应商');
      // 返回供应商选择界面
      const { switchCommand } = require('./switch');
      switchCommand();
    }, '取消添加');

    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: '请输入供应商名称 (用于命令行):',
          default: 'claude-official',
          validate: (input) => {
            const error = validator.validateName(input);
            if (error) return error;
            return true;
          }
        },
        {
          type: 'input',
          name: 'displayName',
          message: '请输入供应商显示名称:',
          default: 'Claude Code 官方 (OAuth)',
          validate: (input) => {
            const error = validator.validateDisplayName(input);
            if (error) return error;
            return true;
          }
        },
        {
          type: 'password',
          name: 'authToken',
          message: '请输入 OAuth Token (sk-ant-oat01-...):',
          validate: (input) => {
            if (!input || !input.startsWith('sk-ant-oat01-')) {
              return '请输入有效的 OAuth Token (格式: sk-ant-oat01-...)';
            }
            const error = validator.validateToken(input);
            if (error) return error;
            return true;
          },
          mask: '*'
        },
        {
          type: 'confirm',
          name: 'setAsDefault',
          message: '是否设置为默认供应商?',
          default: true
        }
      ]);

      // 移除 ESC 键监听
      this.removeESCListener(escListener);
      
      // 使用官方 OAuth 配置
      await this.saveProvider({
        ...answers,
        authMode: 'oauth_token',
        baseUrl: null // OAuth 模式不需要 baseUrl
      });
    } catch (error) {
      // 移除 ESC 键监听
      this.removeESCListener(escListener);
      throw error;
    }
  }

  async addCustomProvider() {
    console.log(UIHelper.createTitle('添加自定义供应商', UIHelper.icons.add));
    console.log();
    console.log(UIHelper.createTooltip('请填写供应商配置信息'));
    console.log();
    
    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('取消添加供应商');
      // 返回供应商选择界面
      const { switchCommand } = require('./switch');
      switchCommand();
    }, '取消添加');

    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: '请输入供应商名称 (用于命令行):',
          validate: (input) => {
            const error = validator.validateName(input);
            if (error) return error;
            return true;
          }
        },
        {
          type: 'input',
          name: 'displayName',
          message: '请输入供应商显示名称 (可选，默认为供应商名称):',
          validate: (input) => {
            const error = validator.validateDisplayName(input);
            if (error) return error;
            return true;
          }
        },
        {
          type: 'list',
          name: 'authMode',
          message: '选择认证模式:',
          choices: [
            { name: 'API Token (ANTHROPIC_AUTH_TOKEN)', value: 'api_token' },
            { name: 'OAuth Token (CLAUDE_CODE_OAUTH_TOKEN)', value: 'oauth_token' }
          ],
          default: 'api_token'
        },
        {
          type: 'input',
          name: 'baseUrl',
          message: '请输入API基础URL:',
          validate: (input) => {
            const error = validator.validateUrl(input);
            if (error) return error;
            return true;
          },
          when: (answers) => answers.authMode === 'api_token'
        },
        {
          type: 'password',
          name: 'authToken',
          message: '请输入认证Token:',
          validate: (input) => {
            const error = validator.validateToken(input);
            if (error) return error;
            return true;
          },
          mask: '*'
        },
        {
          type: 'confirm',
          name: 'setAsDefault',
          message: '是否设置为默认供应商?',
          default: false
        },
        {
          type: 'confirm',
          name: 'configureLaunchArgs',
          message: '是否配置启动参数?',
          default: false
        }
      ]);

      // 移除 ESC 键监听
      this.removeESCListener(escListener);
      
      await this.saveProvider(answers);
    } catch (error) {
      // 移除 ESC 键监听
      this.removeESCListener(escListener);
      throw error;
    }
  }

  async saveProvider(answers) {
    try {
      await this.configManager.load();
      
      // 检查供应商是否已存在
      if (this.configManager.getProvider(answers.name)) {
        // 设置 ESC 键监听
        const escListener = this.createESCListener(() => {
          Logger.info('取消覆盖供应商');
          // 返回供应商选择界面
          const { switchCommand } = require('./switch');
          switchCommand();
        }, '取消覆盖');

        try {
          const overwrite = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'overwrite',
              message: `供应商 '${answers.name}' 已存在，是否覆盖?`,
              default: false
            }
          ]);

          // 移除 ESC 键监听
          this.removeESCListener(escListener);

          if (!overwrite.overwrite) {
            Logger.warning('操作已取消');
            return;
          }
        } catch (error) {
          // 移除 ESC 键监听
          this.removeESCListener(escListener);
          throw error;
        }
      }

      // 如果需要配置启动参数
      let launchArgs = [];
      if (answers.configureLaunchArgs) {
        console.log(UIHelper.createTitle('配置启动参数', UIHelper.icons.settings));
        console.log();
        console.log(UIHelper.createTooltip('选择要使用的启动参数'));
        console.log();

        // 设置 ESC 键监听
        const escListener = this.createESCListener(() => {
          Logger.info('跳过启动参数配置');
          // 继续保存供应商但不配置启动参数
        }, '跳过配置');

        try {
          const launchArgsAnswers = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'launchArgs',
              message: '请选择启动参数:',
              choices: validator.getAvailableLaunchArgs().map(arg => ({
                name: `${arg.name} - ${arg.description}`,
                value: arg.name,
                checked: false
              }))
            }
          ]);

          // 移除 ESC 键监听
          this.removeESCListener(escListener);
          
          launchArgs = launchArgsAnswers.launchArgs;
        } catch (error) {
          // 移除 ESC 键监听
          this.removeESCListener(escListener);
          // 如果用户按ESC，我们继续但不配置启动参数
          launchArgs = [];
        }
      }

      await this.configManager.addProvider(answers.name, {
        displayName: answers.displayName || answers.name,
        baseUrl: answers.baseUrl,
        authToken: answers.authToken,
        authMode: answers.authMode,
        launchArgs: launchArgs,
        setAsDefault: answers.setAsDefault
      });

      const finalDisplayName = answers.displayName || answers.name;
      Logger.success(`供应商 '${finalDisplayName}' 添加成功！`);
      
      // 显示添加的配置信息
      console.log(chalk.blue('\n配置详情:'));
      console.log(chalk.gray(`  名称: ${answers.name}`));
      console.log(chalk.gray(`  显示名称: ${finalDisplayName}`));
      console.log(chalk.gray(`  认证模式: ${answers.authMode === 'oauth_token' ? 'OAuth Token' : 'API Token'}`));
      if (answers.baseUrl) {
        console.log(chalk.gray(`  基础URL: ${answers.baseUrl}`));
      }
      console.log(chalk.gray(`  Token: ${validator.maskToken(answers.authToken)}`));
      if (launchArgs.length > 0) {
        console.log(chalk.gray(`  启动参数: ${launchArgs.join(' ')}`));
      }
      
    } catch (error) {
      Logger.error(`添加供应商失败: ${error.message}`);
      throw error;
    }
  }
}

async function addCommand() {
  const adder = new ProviderAdder();
  await adder.interactive();
}

module.exports = { addCommand, ProviderAdder };