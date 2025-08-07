const inquirer = require('inquirer');
const { ConfigManager } = require('../config');
const { Logger } = require('../utils/logger');
const { UIHelper } = require('../utils/ui-helper');
const { BaseCommand } = require('./BaseCommand');

class ProviderRemover extends BaseCommand {
  constructor() {
    super();
    this.configManager = new ConfigManager();
  }

  async remove(providerName) {
    try {
      await this.configManager.ensureLoaded();
      
      // 如果没有指定供应商名称，显示选择列表
      if (!providerName) {
        return await this.interactiveRemove();
      }

      // 直接删除指定供应商
      if (!this.configManager.getProvider(providerName)) {
        Logger.error(`供应商 '${providerName}' 不存在`);
        return;
      }

      const provider = this.configManager.getProvider(providerName);
      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `确定要删除供应商 '${provider.displayName}' 吗?`,
          default: false
        }
      ]);

      if (!confirm.confirm) {
        Logger.warning('删除操作已取消');
        return;
      }

      await this.configManager.removeProvider(providerName);
      Logger.success(`供应商 '${provider.displayName}' 已删除`);
      
    } catch (error) {
      Logger.error(`删除供应商失败: ${error.message}`);
      throw error;
    }
  }

  async interactiveRemove() {
    await this.configManager.ensureLoaded();
    const providers = this.configManager.listProviders();
    
    if (providers.length === 0) {
      Logger.warning('暂无配置的供应商');
      return;
    }

    console.log(UIHelper.createTitle('删除供应商', UIHelper.icons.delete));
    console.log();
    console.log(UIHelper.createTooltip('选择要删除的供应商'));
    console.log();

    const choices = providers.map(provider => ({
      name: `${provider.current ? '✅' : '🔹'} ${provider.name} (${provider.displayName})`,
      value: provider.name,
      short: provider.name
    }));

    choices.push(
      new inquirer.Separator(),
      { name: '❌ 取消删除', value: '__CANCEL__' }
    );

    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('取消删除供应商');
      // 使用CommandRegistry避免循环引用
      const { registry } = require('../CommandRegistry');
      registry.executeCommand('switch');
    }, '取消删除');

    try {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: '选择要删除的供应商:',
          choices,
          pageSize: 10
        }
      ]);

      // 移除 ESC 键监听
      this.removeESCListener(escListener);

      if (answer.provider === '__CANCEL__') {
        Logger.info('删除操作已取消');
        return;
      }

      await this.remove(answer.provider);
    } catch (error) {
      // 移除 ESC 键监听
      this.removeESCListener(escListener);
      throw error;
    }
  }
}

async function removeCommand(providerName) {
  const remover = new ProviderRemover();
  try {
    await remover.remove(providerName);
  } finally {
    // 确保资源清理
    remover.destroy();
  }
}

module.exports = { removeCommand, ProviderRemover };