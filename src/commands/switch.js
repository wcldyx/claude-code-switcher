const inquirer = require('inquirer');
const chalk = require('chalk');
const { ConfigManager } = require('../config');
const { WindowsSupport } = require('../utils/windows-support');
const { Logger } = require('../utils/logger');
const { UIHelper } = require('../utils/ui-helper');
const { BaseCommand } = require('./BaseCommand');
const { validator } = require('../utils/validator');

class EnvSwitcher extends BaseCommand {
  constructor() {
    super();
    this.configManager = new ConfigManager();
  }

  async validateProvider(providerName) {
    await this.configManager.load();
    const provider = this.configManager.getProvider(providerName);
    if (!provider) {
      throw new Error(`供应商 '${providerName}' 不存在`);
    }
    return provider;
  }

  async showLaunchArgsSelection(providerName) {
    try {
      const provider = await this.validateProvider(providerName);
      const availableArgs = this.getAvailableLaunchArgs();
      
      console.log(UIHelper.createTitle('启动配置', UIHelper.icons.launch));
      console.log();
      console.log(UIHelper.createCard('供应商', UIHelper.formatProvider(provider), UIHelper.icons.info));
      console.log();
      
      // 设置 ESC 键监听
      const escListener = this.createESCListener(() => {
        Logger.info('返回供应商选择');
        this.showProviderSelection();
      }, '返回供应商选择');
      
      // 显示启动参数选择界面
      const choices = [
        {
          type: 'checkbox',
          name: 'selectedArgs',
          message: '选择启动参数（按空格选择，按 a 全选，按 i 反选，按回车继续）:',
          instructions: false,
          choices: availableArgs.map(arg => ({
            name: `${UIHelper.colors.accent(arg.name)} - ${UIHelper.colors.muted(arg.description)}`,
            value: arg.name,
            checked: arg.checked || false
          }))
        }
      ];

      const answers = await inquirer.prompt(choices);
      
      // 移除 ESC 键监听
      this.removeESCListener(escListener);

      // 选择参数后直接启动
      await this.launchProvider(provider, answers.selectedArgs);
      
    } catch (error) {
      await this.handleError(error, '选择启动参数');
    }
  }

  async launchProvider(provider, selectedLaunchArgs) {
    try {
      console.log(UIHelper.createTitle('正在启动', UIHelper.icons.loading));
      console.log();
      console.log(UIHelper.createCard('目标供应商', UIHelper.formatProvider(provider), UIHelper.icons.launch));
      
      if (selectedLaunchArgs.length > 0) {
        console.log(UIHelper.createCard('启动参数', selectedLaunchArgs.join(', '), UIHelper.icons.settings));
      }
      console.log();
      
      // 显示进度
      const loadingInterval = UIHelper.createLoadingAnimation('正在设置环境...');
      
      try {
        // 设置为当前供应商
        await this.configManager.setCurrentProvider(provider.name);
        
        // 更新使用统计
        provider.usageCount = (provider.usageCount || 0) + 1;
        provider.lastUsed = new Date().toISOString();
        await this.configManager.save();
        
        UIHelper.clearLoadingAnimation(loadingInterval);
        
        console.log(UIHelper.createCard('准备就绪', '环境配置完成，正在启动 Claude Code...', UIHelper.icons.success));
        console.log();
        
        // 设置环境变量并启动Claude Code
        await WindowsSupport.executeWithEnv(provider, selectedLaunchArgs);
        
      } catch (error) {
        UIHelper.clearLoadingAnimation(loadingInterval);
        throw error;
      }
      
    } catch (error) {
      await this.handleError(error, '启动供应商');
    }
  }

  getAvailableLaunchArgs() {
    return [
      {
        name: '--dangerously-skip-permissions',
        description: '跳过所有权限检查（建议仅在沙盒环境中使用）',
        checked: false
      },
      {
        name: '--continue',
        description: '继续最近的对话',
        checked: false
      }
    ];
  }

  // getArgDescription 方法已被移除，直接使用 arg.description

  async showProviderSelection() {
    try {
      // 并行加载配置和准备界面
      const providers = await this.configManager.ensureLoaded().then(() => this.configManager.listProviders());
      
      // 显示欢迎界面
      this.showWelcomeScreen(providers);
      
      if (providers.length === 0) {
        Logger.warning('暂无配置的供应商');
        Logger.info('请先运行 "cc add" 添加供应商配置');
        return;
      }

      const choices = this.createProviderChoices(providers);
      
      // 添加特殊选项
      choices.push(
        new inquirer.Separator(),
        { name: `${UIHelper.icons.add} 添加新供应商`, value: '__ADD__' },
        { name: `${UIHelper.icons.list} 供应商管理`, value: '__MANAGE__' },
        { name: `${UIHelper.icons.settings} 快速设置`, value: '__SETTINGS__' },
        { name: `${UIHelper.icons.error} 退出`, value: '__EXIT__' }
      );

      // 获取当前供应商作为默认选项
      const currentProvider = providers.find(p => p.current);
      const defaultChoice = currentProvider ? currentProvider.name : providers[0]?.name;

      // 设置 ESC 键监听
      const escListener = this.createESCListener(() => {
        Logger.info('退出程序');
        this.showExitScreen();
        process.exit(0);
      }, '退出程序');

      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: '请选择要切换的供应商:',
          choices,
          default: defaultChoice,
          pageSize: 12
        }
      ]);
      
      // 移除 ESC 键监听
      this.removeESCListener(escListener);

      return this.handleSelection(answer.provider);
      
    } catch (error) {
      await this.handleError(error, '显示供应商选择');
    }
  }

  showWelcomeScreen(providers) {
    console.log(UIHelper.createTitle('Claude Code 供应商管理器', UIHelper.icons.home));
    console.log();
    
    if (providers.length > 0) {
      const currentProvider = providers.find(p => p.current);
      if (currentProvider) {
        console.log(UIHelper.createCard('当前供应商', 
          `${UIHelper.formatProvider(currentProvider)}\n` +
          `最后使用: ${UIHelper.formatTime(currentProvider.lastUsed)}`,
          UIHelper.icons.current
        ));
      }
      
      console.log(UIHelper.colors.info(`总共 ${providers.length} 个供应商配置`));
    }
    
    console.log();
    console.log(UIHelper.createTooltip('使用方向键选择，回车确认'));
    console.log(UIHelper.colors.muted('快捷键:'));
    console.log(`${UIHelper.createShortcutHint('Ctrl+C', '退出程序')}`);
    console.log(`${UIHelper.createShortcutHint('Tab', '切换选项')}`);
    console.log(`${UIHelper.createESCHint('退出程序')}`);
    console.log();
  }

  async handleSelection(selection) {
    switch (selection) {
      case '__ADD__':
        // 使用CommandRegistry避免循环引用
        const { registry } = require('../CommandRegistry');
        return await registry.executeCommand('add');
      case '__MANAGE__':
        return await this.showManageMenu();
      case '__SETTINGS__':
        return await this.showQuickSettings();
      case '__EXIT__':
        this.showExitScreen();
        process.exit(0);
      default:
        return await this.showLaunchArgsSelection(selection);
    }
  }

  async showQuickSettings() {
    const choices = [
      { name: `${UIHelper.icons.search} 搜索供应商`, value: 'search' },
      { name: `${UIHelper.icons.edit} 批量编辑`, value: 'batch' },
      { name: `${UIHelper.icons.settings} 全局设置`, value: 'global' },
      { name: `${UIHelper.icons.info} 查看统计`, value: 'stats' },
      { name: `${UIHelper.icons.back} 返回主菜单`, value: 'back' }
    ];

    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('返回供应商选择');
      this.showProviderSelection();
    }, '返回供应商选择');

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'setting',
        message: '快速设置:',
        choices,
        pageSize: 8
      }
    ]);
    
    // 移除 ESC 键监听
    this.removeESCListener(escListener);

    switch (answer.setting) {
      case 'search':
        return await this.showSearchProvider();
      case 'batch':
        return await this.showBatchEdit();
      case 'global':
        return await this.showGlobalSettings();
      case 'stats':
        return await this.showStatistics();
      case 'back':
        return await this.showProviderSelection();
    }
  }

  async showBatchEdit() {
    console.log(UIHelper.createTitle('批量编辑', UIHelper.icons.edit));
    console.log();
    console.log(UIHelper.createTooltip('此功能正在开发中...'));
    console.log();
    
    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('返回快速设置');
      this.showQuickSettings();
    }, '返回快速设置');
    
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: '按回车键返回...'
      }
    ]);
    
    // 移除 ESC 键监听
    this.removeESCListener(escListener);

    return await this.showQuickSettings();
  }

  async showGlobalSettings() {
    console.log(UIHelper.createTitle('全局设置', UIHelper.icons.settings));
    console.log();
    console.log(UIHelper.createTooltip('此功能正在开发中...'));
    console.log();
    
    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('返回快速设置');
      this.showQuickSettings();
    }, '返回快速设置');
    
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: '按回车键返回...'
      }
    ]);
    
    // 移除 ESC 键监听
    this.removeESCListener(escListener);

    return await this.showQuickSettings();
  }

  async showSearchProvider() {
    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('返回快速设置');
      this.showQuickSettings();
    }, '返回快速设置');

    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'search',
        message: '输入供应商名称搜索:',
        validate: input => input.trim() !== '' || '请输入搜索内容'
      }
    ]);
    
    // 移除 ESC 键监听
    this.removeESCListener(escListener);

    await this.configManager.load();
    const providers = this.configManager.listProviders();
    const searchResults = providers.filter(p => 
      p.name.toLowerCase().includes(answer.search.toLowerCase()) ||
      p.displayName.toLowerCase().includes(answer.search.toLowerCase())
    );

    if (searchResults.length === 0) {
      Logger.warning('未找到匹配的供应商');
      return await this.showQuickSettings();
    }

    const choices = searchResults.map(p => ({
      name: UIHelper.formatProvider(p),
      value: p.name
    }));

    choices.push(
      new inquirer.Separator(),
      { name: `${UIHelper.icons.back} 返回设置`, value: 'back' }
    );

    // 获取当前供应商作为默认选项（在搜索结果中）
    const currentProvider = searchResults.find(p => p.current);
    const defaultChoice = currentProvider ? currentProvider.name : searchResults[0]?.name;

    // 设置 ESC 键监听
    const escListener2 = this.createESCListener(() => {
      Logger.info('返回快速设置');
      this.showQuickSettings();
    }, '返回快速设置');

    const result = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: '搜索结果:',
        choices,
        default: defaultChoice,
        pageSize: 10
      }
    ]);
    
    // 移除 ESC 键监听
    this.removeESCListener(escListener2);

    if (result.provider === 'back') {
      return await this.showQuickSettings();
    }

    return await this.showProviderDetails(result.provider);
  }

  async showStatistics() {
    await this.configManager.load();
    const providers = this.configManager.listProviders();
    
    const totalProviders = providers.length;
    const currentProvider = providers.find(p => p.current);
    const totalUsage = providers.reduce((sum, p) => sum + (p.usageCount || 0), 0);
    const mostUsed = providers.reduce((max, p) => (p.usageCount || 0) > (max.usageCount || 0) ? p : max, providers[0]);

    console.log(UIHelper.createTitle('使用统计', UIHelper.icons.info));
    console.log();
    
    const stats = [
      ['总供应商数', totalProviders],
      ['当前供应商', currentProvider ? currentProvider.displayName : '无'],
      ['总使用次数', totalUsage],
      ['最常用供应商', mostUsed ? mostUsed.displayName : '无'],
      ['创建时间', providers.length > 0 ? UIHelper.formatTime(providers[0].createdAt) : '无']
    ];
    
    console.log(UIHelper.createTable(['项目', '数据'], stats));
    console.log();
    
    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('返回快速设置');
      this.showQuickSettings();
    }, '返回快速设置');
    
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: '按回车键继续...'
      }
    ]);
    
    // 移除 ESC 键监听
    this.removeESCListener(escListener);

    return await this.showQuickSettings();
  }

  showExitScreen() {
    console.log(UIHelper.createTitle('感谢使用', UIHelper.icons.home));
    console.log();
    console.log(UIHelper.colors.info('再见！期待下次使用 🎉'));
    console.log();
  }

  async showManageMenu() {
    try {
      await this.configManager.load();
      const providers = this.configManager.listProviders();
      
      console.log(UIHelper.createTitle('供应商管理', UIHelper.icons.list));
      console.log();
      
      if (providers.length === 0) {
        console.log(UIHelper.createCard('提示', '暂无配置的供应商\n请先运行 "cc add" 添加供应商配置', UIHelper.icons.warning));
        return await this.showProviderSelection();
      }

      const choices = this.createProviderChoices(providers, true);
      
      // 设置 ESC 键监听
      const escListener = this.createESCListener(() => {
        Logger.info('返回供应商选择');
        this.showProviderSelection();
      }, '返回供应商选择');

      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: '选择供应商或操作:',
          choices,
          pageSize: 12
        }
      ]);
      
      // 移除 ESC 键监听
      this.removeESCListener(escListener);

      return await this.handleManageAction(answer.action);
      
    } catch (error) {
      await this.handleError(error, '显示供应商管理');
    }
  }

  createProviderChoices(providers, includeActions = false) {
    const choices = providers.map(provider => ({
      name: UIHelper.formatProvider(provider),
      value: provider.name,
      short: provider.name
    }));

    if (includeActions) {
      choices.push(
        new inquirer.Separator(),
        { name: `${UIHelper.icons.edit} 编辑供应商`, value: '__EDIT__' },
        { name: `${UIHelper.icons.delete} 删除供应商`, value: '__REMOVE__' },
        { name: `${UIHelper.icons.back} 返回供应商选择`, value: 'back' },
        { name: `${UIHelper.icons.error} 退出`, value: 'exit' }
      );
    }

    return choices;
  }

  async handleManageAction(action) {
    switch (action) {
      case '__EDIT__':
        return await this.showProviderSelectionForAction('edit', '选择要编辑的供应商:');
      case '__REMOVE__':
        return await this.showProviderSelectionForAction('remove', '选择要删除的供应商:');
      case 'back':
        return await this.showProviderSelection();
      case 'exit':
        Logger.info('👋 再见！');
        process.exit(0);
      default:
        // 如果选择的是供应商名称，显示该供应商的详细信息
        return await this.showProviderDetails(action);
    }
  }

  async showProviderSelectionForAction(action, message) {
    try {
      await this.configManager.load();
      const providers = this.configManager.listProviders();
      
      const choices = this.createProviderChoices(providers);
      
      choices.push(
        new inquirer.Separator(),
        { name: '🔙 返回', value: 'back' }
      );

      // 获取当前供应商作为默认选项
      const currentProvider = providers.find(p => p.current);
      const defaultChoice = currentProvider ? currentProvider.name : providers[0]?.name;

      // 设置 ESC 键监听
      const escListener = this.createESCListener(() => {
        Logger.info('返回管理列表');
        this.showManageMenu();
      }, '返回管理列表');

      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message,
          choices,
          default: defaultChoice,
          pageSize: 10
        }
      ]);

      if (answer.provider === 'back') {
        // 移除 ESC 键监听
        this.removeESCListener(escListener);
        return await this.showManageMenu();
      }

      // 移除 ESC 键监听
      this.removeESCListener(escListener);

      if (action === 'edit') {
        return await this.editProvider(answer.provider);
      } else if (action === 'remove') {
        return await this.removeProvider(answer.provider);
      }
      
    } catch (error) {
      // 移除 ESC 键监听
      this.removeESCListener(escListener);
      const actionText = action === 'edit' ? '编辑' : '删除';
      Logger.error(`${actionText}供应商选择失败: ${error.message}`);
      throw error;
    }
  }

  async showProviderDetails(providerName) {
    try {
      const provider = await this.validateProvider(providerName);
      
      console.log(UIHelper.createTitle('供应商详情', UIHelper.icons.info));
      console.log();
      
      const details = [
        ['供应商名称', provider.name],
        ['显示名称', provider.displayName],
        ['认证模式', provider.authMode === 'oauth_token' ? 'OAuth令牌模式' : 'API密钥模式'],
        ['基础URL', provider.baseUrl || (provider.authMode === 'oauth_token' ? '✨ 官方默认服务器' : '⚠️ 未设置')],
        ['认证令牌', provider.authToken || '未设置'],
        ['主模型', provider.models?.primary || '未设置'],
        ['快速模型', provider.models?.smallFast || '未设置'],
        ['创建时间', UIHelper.formatTime(provider.createdAt)],
        ['最后使用', UIHelper.formatTime(provider.lastUsed)],
        ['当前状态', provider.current ? '✅ 使用中' : '⚫ 未使用'],
        ['使用次数', provider.usageCount || 0]
      ];
      
      console.log(UIHelper.createTable(['项目', '信息'], details));
      console.log();
      
      if (provider.launchArgs && provider.launchArgs.length > 0) {
        console.log(UIHelper.createCard('默认启动参数', provider.launchArgs.join(', '), UIHelper.icons.settings));
        console.log();
      }

      // 设置 ESC 键监听
      const escListener = this.createESCListener(() => {
        Logger.info('返回管理列表');
        this.showManageMenu();
      }, '返回管理列表');

      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: '选择操作:',
          choices: [
            { name: `${UIHelper.icons.launch} 立即启动`, value: 'launch' },
            { name: `${UIHelper.icons.edit} 编辑供应商`, value: 'edit' },
            { name: `${UIHelper.icons.delete} 删除供应商`, value: 'remove' },
            { name: `${UIHelper.icons.back} 返回管理列表`, value: 'back' }
          ]
        }
      ]);

      switch (answer.action) {
        case 'back':
          // 移除 ESC 键监听
          this.removeESCListener(escListener);
          return await this.showManageMenu();
        case 'edit':
          // 移除 ESC 键监听
          this.removeESCListener(escListener);
          return await this.editProvider(providerName);
        case 'remove':
          // 移除 ESC 键监听
          this.removeESCListener(escListener);
          return await this.removeProvider(providerName);
        case 'launch':
          // 移除 ESC 键监听
          this.removeESCListener(escListener);
          return await this.showLaunchArgsSelection(providerName);
      }
      
    } catch (error) {
      // 移除 ESC 键监听
      this.removeESCListener(escListener);
      await this.handleError(error, '显示供应商详情');
    }
  }

  async editProvider(providerName) {
    try {
      await this.configManager.load();
      const provider = this.configManager.getProvider(providerName);
      
      if (!provider) {
        Logger.error(`供应商 '${providerName}' 不存在`);
        return await this.showManageMenu();
      }

      // 设置 ESC 键监听
      const escListener = this.createESCListener(() => {
        Logger.info('取消编辑供应商');
        this.showManageMenu();
      }, '取消编辑');

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'displayName',
          message: '显示名称:',
          default: provider.displayName
        },
        {
          type: 'list',
          name: 'authMode',
          message: '认证模式:',
          choices: [
            { name: '🔑 API密钥模式 (ANTHROPIC_API_KEY) - 适用于第三方服务商', value: 'api_key' },
            { name: '🔐 认证令牌模式 (ANTHROPIC_AUTH_TOKEN) - 适用于第三方服务商', value: 'auth_token' },
            { name: '🌐 OAuth令牌模式 (CLAUDE_CODE_OAUTH_TOKEN) - 适用于官方Claude Code', value: 'oauth_token' }
          ],
          default: provider.authMode || 'api_key'
        },
        {
          type: 'input',
          name: 'baseUrl',
          message: '基础URL:',
          default: provider.baseUrl,
          when: (answers) => answers.authMode === 'api_key' || answers.authMode === 'auth_token'
        },
        {
          type: 'input',
          name: 'authToken',
          message: (answers) => {
            switch (answers.authMode) {
              case 'api_key':
                return 'API密钥 (ANTHROPIC_API_KEY):';
              case 'auth_token':
                return '认证令牌 (ANTHROPIC_AUTH_TOKEN):';
              case 'oauth_token':
                return 'OAuth令牌 (CLAUDE_CODE_OAUTH_TOKEN):';
              default:
                return '认证令牌:';
            }
          },
          default: provider.authToken
        },
        {
          type: 'input',
          name: 'primaryModel',
          message: '主模型 (ANTHROPIC_MODEL):',
          default: provider.models?.primary || '',
          validate: (input) => {
            const error = validator.validateModel(input);
            if (error) return error;
            return true;
          }
        },
        {
          type: 'input',
          name: 'smallFastModel',
          message: '快速模型 (ANTHROPIC_SMALL_FAST_MODEL):',
          default: provider.models?.smallFast || '',
          validate: (input) => {
            const error = validator.validateModel(input);
            if (error) return error;
            return true;
          }
        }
      ]);

      // 更新供应商配置
      provider.displayName = answers.displayName;
      provider.baseUrl = answers.baseUrl;
      provider.authToken = answers.authToken;
      provider.authMode = answers.authMode;
      
      // 更新模型配置
      if (!provider.models) {
        provider.models = {};
      }
      provider.models.primary = answers.primaryModel || null;
      provider.models.smallFast = answers.smallFastModel || null;

      await this.configManager.save();
      Logger.success(`供应商 '${providerName}' 已更新`);
      
      // 移除 ESC 键监听
      this.removeESCListener(escListener);
      return await this.showManageMenu();
      
    } catch (error) {
      // 移除 ESC 键监听
      this.removeESCListener(escListener);
      Logger.error(`编辑供应商失败: ${error.message}`);
      throw error;
    }
  }

  async removeProvider(providerName) {
    try {
      await this.configManager.load();
      const provider = this.configManager.getProvider(providerName);
      
      if (!provider) {
        Logger.error(`供应商 '${providerName}' 不存在`);
        return await this.showManageMenu();
      }

      // 设置 ESC 键监听
      const escListener = this.createESCListener(() => {
        Logger.info('取消删除供应商');
        this.showManageMenu();
      }, '取消删除');

      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: `确定要删除供应商 '${providerName}' 吗?`,
          default: false
        }
      ]);

      if (confirm.confirmed) {
        await this.configManager.removeProvider(providerName);
        Logger.success(`供应商 '${providerName}' 已删除`);
      } else {
        Logger.info('删除操作已取消');
      }

      // 移除 ESC 键监听
      this.removeESCListener(escListener);
      return await this.showManageMenu();
      
    } catch (error) {
      // 移除 ESC 键监听
      this.removeESCListener(escListener);
      Logger.error(`删除供应商失败: ${error.message}`);
      throw error;
    }
  }
}

async function switchCommand(providerName) {
  const switcher = new EnvSwitcher();
  
  try {
    if (providerName) {
      await switcher.showLaunchArgsSelection(providerName);
    } else {
      await switcher.showProviderSelection();
    }
  } finally {
    // 确保资源清理
    switcher.destroy();
  }
}

async function editCommand(providerName) {
  const switcher = new EnvSwitcher();
  
  try {
    await switcher.editProvider(providerName);
  } finally {
    // 确保资源清理
    switcher.destroy();
  }
}

module.exports = { switchCommand, editCommand, EnvSwitcher };