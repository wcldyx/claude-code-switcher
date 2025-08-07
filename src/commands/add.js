const inquirer = require('inquirer');
const chalk = require('chalk');
const { ConfigManager } = require('../config');
const { validator } = require('../utils/validator');
const { Logger } = require('../utils/logger');
const { UIHelper } = require('../utils/ui-helper');
const { BaseCommand } = require('./BaseCommand');

class ProviderAdder extends BaseCommand {
  constructor() {
    super();
    this.configManager = new ConfigManager();
  }

  async interactive() {
    console.log(UIHelper.createTitle('添加新供应商', UIHelper.icons.add));
    console.log();
    console.log(UIHelper.createTooltip('选择供应商类型或手动配置'));
    console.log();
    
    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('取消添加供应商');
      // 使用CommandRegistry避免循环引用
      const { registry } = require('../CommandRegistry');
      registry.executeCommand('switch');
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
      // 使用CommandRegistry避免循环引用
      const { registry } = require('../CommandRegistry');
      registry.executeCommand('switch');
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
          type: 'input',
          name: 'authToken',
          message: '请输入 OAuth Token (sk-ant-oat01-...):',
          validate: (input) => {
            if (!input || !input.startsWith('sk-ant-oat01-')) {
              return '请输入有效的 OAuth Token (格式: sk-ant-oat01-...)';
            }
            const error = validator.validateToken(input);
            if (error) return error;
            return true;
          }
        },
        {
          type: 'confirm',
          name: 'setAsDefault',
          message: '是否设置为当前供应商?',
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
      // 使用CommandRegistry避免循环引用
      const { registry } = require('../CommandRegistry');
      registry.executeCommand('switch');
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
            { name: '🔑 API密钥模式 (ANTHROPIC_API_KEY) - 适用于第三方服务商', value: 'api_key' },
            { name: '🔐 认证令牌模式 (ANTHROPIC_AUTH_TOKEN) - 适用于第三方服务商', value: 'auth_token' },
            { name: '🌐 OAuth令牌模式 (CLAUDE_CODE_OAUTH_TOKEN) - 适用于官方Claude Code', value: 'oauth_token' }
          ],
          default: 'api_key'
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
          when: (answers) => answers.authMode === 'api_key' || answers.authMode === 'auth_token'
        },
        {
          type: 'input',
          name: 'authToken',
          message: (answers) => {
            switch (answers.authMode) {
              case 'api_key':
                return '请输入API密钥 (ANTHROPIC_API_KEY):';
              case 'auth_token':
                return '请输入认证令牌 (ANTHROPIC_AUTH_TOKEN):';
              case 'oauth_token':
                return '请输入OAuth令牌 (CLAUDE_CODE_OAUTH_TOKEN):';
              default:
                return '请输入认证令牌:';
            }
          },
          validate: (input) => {
            const error = validator.validateToken(input);
            if (error) return error;
            return true;
          }
        },
        {
          type: 'confirm',
          name: 'setAsDefault',
          message: '是否设置为当前供应商?',
          default: true
        },
        {
          type: 'confirm',
          name: 'configureLaunchArgs',
          message: '是否配置启动参数?',
          default: false
        },
        {
          type: 'confirm',
          name: 'configureModels',
          message: '是否配置模型参数?',
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

      // 如果需要配置模型参数
      let primaryModel = null;
      let smallFastModel = null;
      if (answers.configureModels) {
        console.log(UIHelper.createTitle('配置模型参数', UIHelper.icons.settings));
        console.log();
        console.log(UIHelper.createTooltip('配置主模型和快速模型（可选）'));
        console.log();

        // 设置 ESC 键监听
        const escListener = this.createESCListener(() => {
          Logger.info('跳过模型参数配置');
          // 继续保存供应商但不配置模型参数
        }, '跳过配置');

        try {
          const modelAnswers = await inquirer.prompt([
            {
              type: 'input',
              name: 'primaryModel',
              message: '主模型 (ANTHROPIC_MODEL)：',
              default: '',
              validate: (input) => {
                const error = validator.validateModel(input);
                if (error) return error;
                return true;
              }
            },
            {
              type: 'input',
              name: 'smallFastModel',
              message: '快速模型 (ANTHROPIC_SMALL_FAST_MODEL)：',
              default: '',
              validate: (input) => {
                const error = validator.validateModel(input);
                if (error) return error;
                return true;
              }
            }
          ]);

          // 移除 ESC 键监听
          this.removeESCListener(escListener);
          
          primaryModel = modelAnswers.primaryModel;
          smallFastModel = modelAnswers.smallFastModel;
        } catch (error) {
          // 移除 ESC 键监听
          this.removeESCListener(escListener);
          // 如果用户按ESC，我们继续但不配置模型参数
          primaryModel = null;
          smallFastModel = null;
        }
      }

      await this.configManager.addProvider(answers.name, {
        displayName: answers.displayName || answers.name,
        baseUrl: answers.baseUrl,
        authToken: answers.authToken,
        authMode: answers.authMode,
        launchArgs: launchArgs,
        primaryModel: primaryModel,
        smallFastModel: smallFastModel,
        setAsDefault: answers.setAsDefault
      });

      const finalDisplayName = answers.displayName || answers.name;
      Logger.success(`供应商 '${finalDisplayName}' 添加成功！`);
      
      // 显示添加的配置信息
      console.log(chalk.blue('\n配置详情:'));
      console.log(chalk.gray(`  名称: ${answers.name}`));
      console.log(chalk.gray(`  显示名称: ${finalDisplayName}`));
      const authModeDisplay = {
        'api_key': 'API密钥模式 (ANTHROPIC_API_KEY)',
        'auth_token': '认证令牌模式 (ANTHROPIC_AUTH_TOKEN)',
        'oauth_token': 'OAuth令牌模式 (CLAUDE_CODE_OAUTH_TOKEN)'
      };
      console.log(chalk.gray(`  认证模式: ${authModeDisplay[answers.authMode] || answers.authMode}`));
      if (answers.baseUrl) {
        console.log(chalk.gray(`  基础URL: ${answers.baseUrl}`));
      }
      console.log(chalk.gray(`  Token: ${answers.authToken}`));
      if (launchArgs.length > 0) {
        console.log(chalk.gray(`  启动参数: ${launchArgs.join(' ')}`));
      }
      if (primaryModel) {
        console.log(chalk.gray(`  主模型: ${primaryModel}`));
      }
      if (smallFastModel) {
        console.log(chalk.gray(`  快速模型: ${smallFastModel}`));
      }
      
      // 显示成功消息后稍停，然后返回主界面
      console.log(chalk.green('\n🎉 供应商添加完成！正在返回主界面...'));
      
      // 稍微延迟后返回主界面
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 使用CommandRegistry返回主界面
      const { registry } = require('../CommandRegistry');
      return await registry.executeCommand('switch');
      
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