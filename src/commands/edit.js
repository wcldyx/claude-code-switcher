const inquirer = require('inquirer');
const chalk = require('chalk');
const { ConfigManager } = require('../config');
const { validator } = require('../utils/validator');
const { Logger } = require('../utils/logger');
const { UIHelper } = require('../utils/ui-helper');
const { BaseCommand } = require('./BaseCommand');

class ProviderEditor extends BaseCommand {
  constructor() {
    super();
    this.configManager = new ConfigManager();
  }

  async interactive(providerName) {
    await this.configManager.load();
    const providers = this.configManager.listProviders();

    if (providers.length === 0) {
      Logger.warning('没有可编辑的供应商配置。请先添加一个。');
      return;
    }

    let providerToEdit;
    if (providerName) {
        providerToEdit = this.configManager.getProvider(providerName);
        if (!providerToEdit) {
            Logger.error(`供应商 '${providerName}' 不存在。`);
            return;
        }
    } else {
        const { selectedProviderName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedProviderName',
                message: '请选择要编辑的供应商:',
                choices: [
                    ...providers.map(p => ({ name: p.displayName || p.name, value: p.name })),
                    new inquirer.Separator(),
                    { name: '取消', value: null },
                ],
            },
        ]);

        if (!selectedProviderName) {
            Logger.info('操作已取消。');
            return;
        }
        providerToEdit = this.configManager.getProvider(selectedProviderName);
    }

    console.log(UIHelper.createTitle(`编辑供应商: ${providerToEdit.displayName}`, UIHelper.icons.edit));
    console.log();
    console.log(UIHelper.createTooltip('请更新供应商配置信息。按 Enter 键接受默认值。'));
    console.log();

    const escListener = this.createESCListener(() => {
      Logger.info('取消编辑供应商。');
      const { registry } = require('../CommandRegistry');
      registry.executeCommand('switch');
    }, '取消编辑');

    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'displayName',
          message: '供应商显示名称:',
          default: providerToEdit.displayName,
          validate: (input) => validator.validateDisplayName(input) || true,
        },
        {
          type: 'list',
          name: 'authMode',
          message: '认证模式:',
          choices: [
            { name: '🔑 API密钥模式 (ANTHROPIC_API_KEY)', value: 'api_key' },
            { name: '🔐 认证令牌模式 (ANTHROPIC_AUTH_TOKEN)', value: 'auth_token' },
            { name: '🌐 OAuth令牌模式 (CLAUDE_CODE_OAUTH_TOKEN)', value: 'oauth_token' },
          ],
          default: providerToEdit.authMode,
        },
        {
          type: 'input',
          name: 'baseUrl',
          message: 'API基础URL:',
          default: providerToEdit.baseUrl,
          validate: (input) => validator.validateUrl(input) || true,
          when: (answers) => answers.authMode === 'api_key' || answers.authMode === 'auth_token',
        },
        {
          type: 'input',
          name: 'authToken',
          message: (answers) => {
            switch (answers.authMode) {
              case 'api_key': return 'API密钥 (ANTHROPIC_API_KEY):';
              case 'auth_token': return '认证令牌 (ANTHROPIC_AUTH_TOKEN):';
              case 'oauth_token': return 'OAuth令牌 (CLAUDE_CODE_OAUTH_TOKEN):';
              default: return '认证令牌:';
            }
          },
          default: providerToEdit.authToken,
          validate: (input) => validator.validateToken(input) || true,
        },
        {
            type: 'checkbox',
            name: 'launchArgs',
            message: '启动参数:',
            choices: validator.getAvailableLaunchArgs().map(arg => ({
              name: `${arg.name} - ${arg.description}`,
              value: arg.name,
              checked: providerToEdit.launchArgs && providerToEdit.launchArgs.includes(arg.name),
            })),
        },
      ]);

      this.removeESCListener(escListener);
      await this.saveProvider(providerToEdit.name, answers);

    } catch (error) {
      this.removeESCListener(escListener);
      throw error;
    }
  }

  async saveProvider(name, answers) {
    try {
      // Re-use addProvider which can overwrite existing providers
      await this.configManager.addProvider(name, {
        displayName: answers.displayName,
        baseUrl: answers.baseUrl,
        authToken: answers.authToken,
        authMode: answers.authMode,
        launchArgs: answers.launchArgs,
        // Retain original model settings unless we add editing for them
        primaryModel: this.configManager.getProvider(name).models.primary,
        smallFastModel: this.configManager.getProvider(name).models.smallFast,
        setAsDefault: false, // Don't change default status on edit
      });

      Logger.success(`供应商 '${answers.displayName}' 更新成功！`);

      console.log(chalk.green('\n🎉 供应商编辑完成！正在返回主界面...'));
      await new Promise(resolve => setTimeout(resolve, 1500));

      const { registry } = require('../CommandRegistry');
      return await registry.executeCommand('switch');

    } catch (error) {
      Logger.error(`更新供应商失败: ${error.message}`);
      throw error;
    }
  }
}

async function editCommand(providerName) {
  const editor = new ProviderEditor();
  await editor.interactive(providerName);
}

module.exports = { editCommand, ProviderEditor };
