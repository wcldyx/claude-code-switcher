const chalk = require('chalk');
const { ConfigManager } = require('../config');
const { Logger } = require('../utils/logger');

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
      console.log(chalk.gray(`认证Token: ${currentProvider.authToken}`));
      console.log(chalk.gray(`创建时间: ${new Date(currentProvider.createdAt).toLocaleString()}`));
      console.log(chalk.gray(`最后使用: ${new Date(currentProvider.lastUsed).toLocaleString()}`));
      
      // 显示模型配置
      if (currentProvider.models && (currentProvider.models.opus || currentProvider.models.sonnet || currentProvider.models.haiku)) {
        console.log(chalk.gray(`Opus 模型: ${currentProvider.models.opus || '未设置'}`));
        console.log(chalk.gray(`Sonnet 模型: ${currentProvider.models.sonnet || '未设置'}`));
        console.log(chalk.gray(`Haiku 模型: ${currentProvider.models.haiku || '未设置'}`));
      }
      
      console.log(chalk.gray('═'.repeat(60)));
      
      // 显示环境变量设置方式
      console.log(chalk.blue('\n🔧 环境变量设置:'));
      if (currentProvider.baseUrl) {
        console.log(chalk.gray(`set ANTHROPIC_BASE_URL=${currentProvider.baseUrl}`));
      }
      if (currentProvider.authMode === 'oauth_token') {
        console.log(chalk.gray(`set CLAUDE_CODE_OAUTH_TOKEN=${currentProvider.authToken}`));
      } else if (currentProvider.authMode === 'api_key') {
        console.log(chalk.gray(`set ANTHROPIC_API_KEY=${currentProvider.authToken}`));
      } else {
        // auth_token 模式或默认模式
        console.log(chalk.gray(`set ANTHROPIC_AUTH_TOKEN=${currentProvider.authToken}`));
      }
      if (currentProvider.models?.opus) {
        console.log(chalk.gray(`set ANTHROPIC_DEFAULT_OPUS_MODEL=${currentProvider.models.opus}`));
      }
      if (currentProvider.models?.sonnet) {
        console.log(chalk.gray(`set ANTHROPIC_DEFAULT_SONNET_MODEL=${currentProvider.models.sonnet}`));
      }
      if (currentProvider.models?.haiku) {
        console.log(chalk.gray(`set ANTHROPIC_DEFAULT_HAIKU_MODEL=${currentProvider.models.haiku}`));
      }
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
