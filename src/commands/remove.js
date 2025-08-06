const inquirer = require('inquirer');
const chalk = require('chalk');
const readline = require('readline');
const { ConfigManager } = require('../config');
const { Logger } = require('../utils/logger');
const { UIHelper } = require('../utils/ui-helper');

class ProviderRemover {
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

  async remove(providerName) {
    try {
      await this.configManager.load();
      
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
    await this.configManager.load();
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
      // 返回供应商选择界面
      const { switchCommand } = require('./switch');
      switchCommand();
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
  await remover.remove(providerName);
}

module.exports = { removeCommand, ProviderRemover };