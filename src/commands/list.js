const chalk = require('chalk');
const { ConfigManager } = require('../config');
const { Logger } = require('../utils/logger');
const { ProviderStatusChecker } = require('../utils/provider-status-checker');

class ProviderLister {
  constructor() {
    this.configManager = new ConfigManager();
    this.statusChecker = new ProviderStatusChecker();
  }

  async list() {
    try {
      await this.configManager.ensureLoaded();
      const providers = this.configManager.listProviders();
      const currentProvider = this.configManager.getCurrentProvider();
      const statusMap = await this.statusChecker.checkAll(providers);

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
        const availability = statusMap[provider.name] || { state: 'unknown', label: '未知', latency: null };
        const availabilityIcon = this._iconForState(availability.state);
        const availabilityText = this._formatAvailability(availability);
        const nameColor = isCurrent ? chalk.green : chalk.white;
        
        console.log(`${status} ${availabilityIcon} ${nameColor(provider.name)} (${provider.displayName}) - ${availabilityText}`);
        console.log(chalk.gray(`   URL: ${provider.baseUrl}`));
        console.log(chalk.gray(`   Token: ${provider.authToken}`));
        if (provider.launchArgs && provider.launchArgs.length > 0) {
          console.log(chalk.gray(`   启动参数: ${provider.launchArgs.join(' ')}`));
        }
        if (provider.models && (provider.models.opus || provider.models.sonnet || provider.models.haiku)) {
          console.log(chalk.gray(`   Opus 模型: ${provider.models.opus || '未设置'}`));
          console.log(chalk.gray(`   Sonnet 模型: ${provider.models.sonnet || '未设置'}`));
          console.log(chalk.gray(`   Haiku 模型: ${provider.models.haiku || '未设置'}`));
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

  _iconForState(state) {
    if (state === 'online') {
      return '🟢';
    }
    if (state === 'degraded') {
      return '🟡';
    }
    if (state === 'offline') {
      return '🔴';
    }
    return '⚪';
  }

  _formatAvailability(availability) {
    if (!availability) {
      return '未知';
    }
    if (availability.state === 'online') {
      return chalk.green(availability.label);
    }
    if (availability.state === 'degraded') {
      return chalk.yellow(availability.label);
    }
    if (availability.state === 'offline') {
      return chalk.red(availability.label);
    }
    return chalk.gray(availability.label || '未知');
  }
}

async function listCommand() {
  const lister = new ProviderLister();
  await lister.list();
}

module.exports = { listCommand, ProviderLister };
