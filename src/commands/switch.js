const inquirer = require('inquirer');
const chalk = require('chalk');
const { ConfigManager } = require('../config');
const { WindowsSupport } = require('../utils/windows-support');
const { Logger } = require('../utils/logger');

class EnvSwitcher {
  constructor() {
    this.configManager = new ConfigManager();
  }

  async switchTo(providerName) {
    try {
      await this.configManager.load();
      
      const provider = this.configManager.getProvider(providerName);
      if (!provider) {
        Logger.error(`供应商 '${providerName}' 不存在`);
        return;
      }

      Logger.step(`正在切换到 ${provider.displayName}...`);
      
      // 设置为当前供应商
      await this.configManager.setCurrentProvider(providerName);
      
      // 设置环境变量并启动Claude Code
      await WindowsSupport.executeWithEnv(provider);
      
    } catch (error) {
      Logger.error(`切换供应商失败: ${error.message}`);
      throw error;
    }
  }

  async showProviderSelection() {
    try {
      await this.configManager.load();
      const providers = this.configManager.listProviders();
      
      if (providers.length === 0) {
        Logger.warning('暂无配置的供应商');
        Logger.info('请先运行 "cc add" 添加供应商配置');
        return;
      }

      const choices = providers.map(provider => ({
        name: `${provider.current ? '✅' : '🔹'} ${provider.name} (${provider.displayName})`,
        value: provider.name,
        short: provider.name
      }));

      // 添加特殊选项
      choices.push(
        new inquirer.Separator(),
        { name: '➕ 添加新供应商', value: '__ADD__' },
        { name: '⚙️ 管理配置', value: '__MANAGE__' },
        { name: '❌ 退出', value: '__EXIT__' }
      );

      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: '请选择要切换的供应商:',
          choices,
          pageSize: 10
        }
      ]);

      return this.handleSelection(answer.provider);
      
    } catch (error) {
      Logger.error(`显示供应商选择失败: ${error.message}`);
      throw error;
    }
  }

  async handleSelection(selection) {
    switch (selection) {
      case '__ADD__':
        const { addCommand } = require('./add');
        return await addCommand();
      case '__MANAGE__':
        return await this.showManageMenu();
      case '__EXIT__':
        Logger.info('👋 再见！');
        process.exit(0);
      default:
        return await this.switchTo(selection);
    }
  }

  async showManageMenu() {
    const choices = [
      { name: '📋 查看所有供应商', value: 'list' },
      { name: '📍 显示当前配置', value: 'current' },
      { name: '🗑️ 删除供应商', value: 'remove' },
      { name: '↩️ 返回主菜单', value: 'back' }
    ];

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '选择管理操作:',
        choices
      }
    ]);

    switch (answer.action) {
      case 'list':
        const { listCommand } = require('./list');
        await listCommand();
        break;
      case 'current':
        const { currentCommand } = require('./current');
        await currentCommand();
        break;
      case 'remove':
        const { removeCommand } = require('./remove');
        await removeCommand();
        break;
      case 'back':
        return await this.showProviderSelection();
    }

    // 操作完成后返回管理菜单
    await this.showManageMenu();
  }
}

async function switchCommand(providerName) {
  const switcher = new EnvSwitcher();
  
  if (providerName) {
    await switcher.switchTo(providerName);
  } else {
    await switcher.showProviderSelection();
  }
}

module.exports = { switchCommand, EnvSwitcher };