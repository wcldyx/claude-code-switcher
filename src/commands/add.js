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
    console.log(UIHelper.createStepIndicator(1, 3, '选择供应商类型'));
    console.log(UIHelper.createHintLine([
      ['↑ / ↓', '选择类型'],
      ['Enter', '确认'],
      ['ESC', '取消添加']
    ]));
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
      const typeAnswer = await this.prompt([
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
      if (this.isEscCancelled(error)) {
        return;
      }
      throw error;
    }
  }

  async addOfficialOAuthProvider() {
    console.log(UIHelper.createTitle('添加官方 OAuth 供应商', UIHelper.icons.add));
    console.log();
    console.log(UIHelper.createTooltip('配置官方 Claude Code OAuth 认证'));
    console.log();
    console.log(UIHelper.createStepIndicator(2, 3, '填写官方 OAuth 信息'));
    console.log(UIHelper.createHintLine([
      ['Enter', '确认输入'],
      ['Tab', '切换字段'],
      ['ESC', '取消添加']
    ]));
    console.log();
    
    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('取消添加供应商');
      // 使用CommandRegistry避免循环引用
      const { registry } = require('../CommandRegistry');
      registry.executeCommand('switch');
    }, '取消添加');

    try {
      const answers = await this.prompt([
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
      if (this.isEscCancelled(error)) {
        return;
      }
      throw error;
    }
  }

  async addCustomProvider() {
    console.log(UIHelper.createTitle('添加自定义供应商', UIHelper.icons.add));
    console.log();
    console.log(UIHelper.createTooltip('请填写供应商配置信息'));
    console.log();
    console.log(UIHelper.createStepIndicator(2, 3, '填写供应商信息'));
    console.log(UIHelper.createHintLine([
      ['Enter', '确认输入'],
      ['Tab', '切换字段'],
      ['ESC', '取消添加']
    ]));
    console.log();
    
    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('取消添加供应商');
      // 使用CommandRegistry避免循环引用
      const { registry } = require('../CommandRegistry');
      registry.executeCommand('switch');
    }, '取消添加');

    try {
      const answers = await this.prompt([
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

      if (this.configManager.getProvider(answers.name)) {
        const shouldOverwrite = await this.confirmOverwrite(answers.name);
        if (!shouldOverwrite) {
          Logger.warning('操作已取消');
          return;
        }
      }

      const launchArgs = answers.configureLaunchArgs
        ? await this.promptLaunchArgsSelection()
        : [];

      const modelConfig = answers.configureModels
        ? await this.promptModelConfiguration()
        : { opusModel: null, sonnetModel: null, haikuModel: null };

      await this.configManager.addProvider(answers.name, {
        displayName: answers.displayName || answers.name,
        baseUrl: answers.baseUrl,
        authToken: answers.authToken,
        authMode: answers.authMode,
        launchArgs,
        opusModel: modelConfig.opusModel,
        sonnetModel: modelConfig.sonnetModel,
        haikuModel: modelConfig.haikuModel,
        setAsDefault: answers.setAsDefault
      });

      this.printProviderSummary(answers, launchArgs, modelConfig);
      await this.pauseBeforeReturn();

      const { registry } = require('../CommandRegistry');
      return await registry.executeCommand('switch');
    } catch (error) {
      if (this.isEscCancelled(error)) {
        return;
      }
      Logger.error(`添加供应商失败: ${error.message}`);
      throw error;
    }
  }

  async confirmOverwrite(name) {
    const escListener = this.createESCListener(() => {
      Logger.info('取消覆盖供应商');
      const { switchCommand } = require('./switch');
      switchCommand();
    }, '取消覆盖');

    try {
      const { overwrite } = await this.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `供应商 '${name}' 已存在，是否覆盖?`,
          default: false
        }
      ]);

      this.removeESCListener(escListener);
      return overwrite;
    } catch (error) {
      this.removeESCListener(escListener);
      throw error;
    }
  }

  async promptLaunchArgsSelection() {
    console.log(UIHelper.createTitle('配置启动参数', UIHelper.icons.settings));
    console.log();
    console.log(UIHelper.createTooltip('选择要使用的启动参数'));
    console.log();
    console.log(UIHelper.createStepIndicator(3, 3, '可选: 配置启动参数'));
    console.log(UIHelper.createHintLine([
      ['空格', '切换选中'],
      ['A', '全选'],
      ['I', '反选'],
      ['Enter', '确认选择'],
      ['ESC', '跳过配置']
    ]));
    console.log();

    const escListener = this.createESCListener(() => {
      Logger.info('跳过启动参数配置');
    }, '跳过配置');

    try {
      const defaultLaunchArgs = this.configManager.getDefaultLaunchArgs();
      const { launchArgs } = await this.prompt([
        {
          type: 'checkbox',
          name: 'launchArgs',
          message: '请选择启动参数:',
          choices: validator.getAvailableLaunchArgs().map(arg => ({
            name: `${arg.name} - ${arg.description}`,
            value: arg.name,
            checked: defaultLaunchArgs.includes(arg.name)
          }))
        }
      ]);

      this.removeESCListener(escListener);
      return launchArgs;
    } catch (error) {
      this.removeESCListener(escListener);
      if (this.isEscCancelled(error)) {
        return [];
      }
      throw error;
    }
  }

  async promptModelConfiguration() {
    console.log(UIHelper.createTitle('配置模型参数', UIHelper.icons.settings));
    console.log();
    console.log(UIHelper.createTooltip('配置 Opus、Sonnet 和 Haiku 模型（可选）'));
    console.log();
    console.log(UIHelper.createStepIndicator(3, 3, '可选: 配置模型参数'));
    console.log(UIHelper.createHintLine([
      ['Enter', '确认输入'],
      ['ESC', '跳过配置']
    ]));
    console.log();

    const escListener = this.createESCListener(() => {
      Logger.info('跳过模型参数配置');
    }, '跳过配置');

    try {
      const responses = await this.prompt([
        {
          type: 'input',
          name: 'opusModel',
          message: 'Opus 模型 (ANTHROPIC_DEFAULT_OPUS_MODEL)：',
          default: '',
          validate: (input) => {
            const error = validator.validateModel(input);
            if (error) return error;
            return true;
          }
        },
        {
          type: 'input',
          name: 'sonnetModel',
          message: 'Sonnet 模型 (ANTHROPIC_DEFAULT_SONNET_MODEL)：',
          default: '',
          validate: (input) => {
            const error = validator.validateModel(input);
            if (error) return error;
            return true;
          }
        },
        {
          type: 'input',
          name: 'haikuModel',
          message: 'Haiku 模型 (ANTHROPIC_DEFAULT_HAIKU_MODEL)：',
          default: '',
          validate: (input) => {
            const error = validator.validateModel(input);
            if (error) return error;
            return true;
          }
        }
      ]);

      this.removeESCListener(escListener);
      return {
        opusModel: responses.opusModel,
        sonnetModel: responses.sonnetModel,
        haikuModel: responses.haikuModel
      };
    } catch (error) {
      this.removeESCListener(escListener);
      if (this.isEscCancelled(error)) {
        return { opusModel: null, sonnetModel: null, haikuModel: null };
      }
      throw error;
    }
  }

  printProviderSummary(answers, launchArgs, modelConfig) {
    const finalDisplayName = answers.displayName || answers.name;
    Logger.success(`供应商 '${finalDisplayName}' 添加成功！`);

    console.log(chalk.blue('\n配置详情:'));
    console.log(chalk.gray(`  名称: ${answers.name}`));
    console.log(chalk.gray(`  显示名称: ${finalDisplayName}`));

    const authModeDisplay = {
      api_key: 'API密钥模式 (ANTHROPIC_API_KEY)',
      auth_token: '认证令牌模式 (ANTHROPIC_AUTH_TOKEN)',
      oauth_token: 'OAuth令牌模式 (CLAUDE_CODE_OAUTH_TOKEN)'
    };

    console.log(chalk.gray(`  认证模式: ${authModeDisplay[answers.authMode] || answers.authMode}`));
    if (answers.baseUrl) {
      console.log(chalk.gray(`  基础URL: ${answers.baseUrl}`));
    }
    console.log(chalk.gray(`  Token: ${answers.authToken}`));

    if (launchArgs.length > 0) {
      console.log(chalk.gray(`  启动参数: ${launchArgs.join(' ')}`));
    }

    if (modelConfig.opusModel) {
      console.log(chalk.gray(`  Opus 模型: ${modelConfig.opusModel}`));
    }

    if (modelConfig.sonnetModel) {
      console.log(chalk.gray(`  Sonnet 模型: ${modelConfig.sonnetModel}`));
    }

    if (modelConfig.haikuModel) {
      console.log(chalk.gray(`  Haiku 模型: ${modelConfig.haikuModel}`));
    }

    console.log(chalk.green('\n🎉 供应商添加完成！正在返回主界面...'));
  }

  async pauseBeforeReturn(delay = 1500) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

async function addCommand() {
  const adder = new ProviderAdder();
  try {
    await adder.interactive();
  } catch (error) {
    if (!adder.isEscCancelled(error)) {
      Logger.error(`添加供应商失败: ${error.message}`);
    }
  } finally {
    adder.destroy();
  }
}

module.exports = { addCommand, ProviderAdder };
