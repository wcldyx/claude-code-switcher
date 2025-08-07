const chalk = require('chalk');
const { ConfigManager } = require('../config');
const { Logger } = require('../utils/logger');
const { validator } = require('../utils/validator');

class CurrentConfig {
  constructor() {
    this.configManager = new ConfigManager();
  }

  async show() {
    try {
      await this.configManager.ensureLoaded();
      const currentProvider = this.configManager.getCurrentProvider();
      
      if (!currentProvider) {
        Logger.warning('未设置当前供应商');
        Logger.info('请使用 "cc <供应商名>" 切换供应商');
        return;
      }

      console.log(chalk.blue('\n📍 当前配置:'));
      console.log(chalk.gray('═'.repeat(60)));
      
      console.log(chalk.green(`供应商: ${currentProvider.displayName}`));
      console.log(chalk.gray(`内部名称: ${currentProvider.name}`));
      console.log(chalk.gray(`基础URL: ${currentProvider.baseUrl}`));
      console.log(chalk.gray(`认证Token: ${validator.maskToken(currentProvider.authToken)}`));
      console.log(chalk.gray(`创建时间: ${new Date(currentProvider.createdAt).toLocaleString()}`));
      console.log(chalk.gray(`最后使用: ${new Date(currentProvider.lastUsed).toLocaleString()}`));
      
      console.log(chalk.gray('═'.repeat(60)));
      
      // 显示环境变量设置方式
      console.log(chalk.blue('\n🔧 环境变量设置:'));
      console.log(chalk.gray(`set ANTHROPIC_BASE_URL=${currentProvider.baseUrl}`));
      console.log(chalk.gray(`set ANTHROPIC_AUTH_TOKEN=${currentProvider.authToken}`));
      console.log(chalk.gray('claude'));
      
    } catch (error) {
      Logger.error(`获取当前配置失败: ${error.message}`);
      throw error;
    }
  }
}

async function currentCommand() {
  const current = new CurrentConfig();
  await current.show();
}

module.exports = { currentCommand, CurrentConfig };