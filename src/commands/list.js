const chalk = require('chalk');
const { ConfigManager } = require('../config');
const { Logger } = require('../utils/logger');

class ProviderLister {
  constructor() {
    this.configManager = new ConfigManager();
  }

  async list() {
    try {
      await this.configManager.ensureLoaded();
      const providers = this.configManager.listProviders();
      const currentProvider = this.configManager.getCurrentProvider();

      if (providers.length === 0) {
        Logger.warning('暂无配置的供应商');
        Logger.info('请使用 "cc add" 添加供应商配置');
        return;
      }

      console.log(chalk.blue('\n📋 供应商列表:'));
      console.log(chalk.gray('═'.repeat(60)));

      providers.forEach((provider, index) => {
        const isCurrent = provider.name === currentProvider?.name;
        const status = isCurrent ? '✅' : '🔹';
        const nameColor = isCurrent ? chalk.green : chalk.white;
        
        console.log(`${status} ${nameColor(provider.name)} (${provider.displayName})`);
        console.log(chalk.gray(`   URL: ${provider.baseUrl}`));
        console.log(chalk.gray(`   Token: ${provider.authToken}`));
        if (provider.launchArgs && provider.launchArgs.length > 0) {
          console.log(chalk.gray(`   启动参数: ${provider.launchArgs.join(' ')}`));
        }
        if (provider.models && (provider.models.primary || provider.models.smallFast)) {
          console.log(chalk.gray(`   主模型: ${provider.models.primary || '未设置'}`));
          console.log(chalk.gray(`   快速模型: ${provider.models.smallFast || '未设置'}`));
        }
        console.log(chalk.gray(`   创建时间: ${new Date(provider.createdAt).toLocaleString()}`));
        console.log(chalk.gray(`   最后使用: ${new Date(provider.lastUsed).toLocaleString()}`));
        
        if (index < providers.length - 1) {
          console.log(chalk.gray('─'.repeat(60)));
        }
      });

      console.log(chalk.gray('═'.repeat(60)));
      
      if (currentProvider) {
        console.log(chalk.green(`\n当前供应商: ${currentProvider.displayName}`));
      } else {
        console.log(chalk.yellow('\n未设置当前供应商'));
      }

      console.log(chalk.blue(`\n总计: ${providers.length} 个供应商`));
      
    } catch (error) {
      Logger.error(`获取供应商列表失败: ${error.message}`);
      throw error;
    }
  }
}

async function listCommand() {
  const lister = new ProviderLister();
  await lister.list();
}

module.exports = { listCommand, ProviderLister };