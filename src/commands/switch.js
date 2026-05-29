const path = require('path');
const chalk = require('chalk');
const { ConfigManager, DEFAULT_RUNTIME_ENV } = require('../config');
const { Logger } = require('../utils/logger');
const { UIHelper } = require('../utils/ui-helper');
const { findSettingsConflict, backupSettingsFile, clearConflictKeys, saveSettingsFile } = require('../utils/claude-settings');
const { BaseCommand } = require('./BaseCommand');
const { validator } = require('../utils/validator');

function getInquirer() {
  require('../utils/inquirer-setup');
  return require('inquirer');
}

function createSeparator() {
  return new (getInquirer().Separator)();
}

function getChoices() {
  return require('inquirer/lib/objects/choices');
}

class EnvSwitcher extends BaseCommand {
  constructor() {
    super();
    this.configManager = new ConfigManager();
    this.statusChecker = null;
    this.latestStatusMap = {};
    this.currentPromptContext = null;
    this.activeStatusRefresh = null;
    this.pendingStatusUpdates = new Map();
    this.statusFlushTimer = null;
    this.statusFlushDelayMs = 300;
    this.lastStatusRenderSignature = null;
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
      this.clearScreen();
      const provider = await this.validateProvider(providerName);
      const availableArgs = this.getAvailableLaunchArgs(provider);

      console.log(UIHelper.createTitle('启动配置', UIHelper.icons.launch));
      console.log();
      console.log(UIHelper.createCard('供应商', UIHelper.formatProvider(provider), UIHelper.icons.info));
      console.log();
      console.log(UIHelper.createHintLine([
        ['空格', '切换选中'],
        ['A', '全选'],
        ['I', '反选'],
        ['Enter', '启动 Claude Code'],
        ['ESC', '返回供应商选择']
      ]));
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
          message: '选择启动参数:',
          choices: availableArgs.map(arg => {
            const commandText = UIHelper.colors.muted(`(${arg.name})`);
            const descriptionText = arg.description
              ? ` ${UIHelper.colors.muted(arg.description)}`
              : '';

            return {
              name: `${UIHelper.colors.accent(arg.label || arg.name)} ${commandText}${descriptionText}`,
              value: arg.name,
              checked: arg.checked || false
            };
          })
        }
      ];

      let answers;
      try {
        answers = await this.prompt(choices);
      } catch (error) {
        this.removeESCListener(escListener);
        if (this.isEscCancelled(error)) {
          return;
        }
        throw error;
      }

      this.removeESCListener(escListener);

      // 选择参数后直接启动
      await this.launchProvider(provider, answers.selectedArgs);

    } catch (error) {
      await this.handleError(error, '选择启动参数');
    }
  }

  async ensureClaudeSettingsCompatibility(provider) {
    try {
      const conflict = await findSettingsConflict();
      if (!conflict) {
        return true;
      }

      const keyList = conflict.keys.map((key) => `• ${key}`).join('\n');

      const backupDir = path.dirname(conflict.filePath);

      this.clearScreen();
      console.log(UIHelper.createTitle('检测到环境变量冲突', UIHelper.icons.warning));
      console.log();
      console.log(UIHelper.createCard('冲突文件', conflict.filePath, UIHelper.icons.info));
      console.log();
      console.log(UIHelper.createCard('备份目录', `${backupDir}\n备份文件将命名为 settings.backup-YYYYMMDD_HHmmss.json`, UIHelper.icons.info));
      console.log();
      console.log(UIHelper.createCard('可能覆盖的变量', keyList, UIHelper.icons.warning));
      console.log();
      console.log(UIHelper.createTooltip('Claude 会优先读取该设置文件中的 env 配置，可能覆盖本次为供应商设置的变量。'));
      console.log();

      let answer;
      try {
        answer = await this.prompt([
          {
            type: 'list',
            name: 'action',
            message: `在 ${conflict.filePath} 中发现 env 配置会覆盖供应商 '${provider.displayName || provider.name}' 的变量，选择处理方式:`,
            choices: [
              { name: '🔧 备份并清空这些变量', value: 'fix' },
              { name: '⚠️ 忽略并继续（可能导致切换失败）', value: 'ignore' },
              { name: '❌ 取消启动', value: 'cancel' }
            ],
            default: 'fix'
          }
        ]);
      } catch (error) {
        if (this.isEscCancelled(error)) {
          Logger.info('已取消启动');
          return false;
        }
        throw error;
      }

      if (answer.action === 'fix') {
        let confirmBackup;
        try {
          confirmBackup = await this.prompt([
            {
              type: 'confirm',
              name: 'confirmed',
              message: `将在 ${backupDir} 中创建备份文件 (settings.backup-YYYYMMDD_HHmmss.json)，并清空冲突变量。是否继续?`,
              default: true
            }
          ]);
        } catch (error) {
          if (this.isEscCancelled(error)) {
            Logger.info('已取消启动');
            return false;
          }
          throw error;
        }

        if (!confirmBackup.confirmed) {
          Logger.info('已取消启动');
          return false;
        }

        try {
          const backupPath = await backupSettingsFile(conflict.filePath);
          const updatedSettings = clearConflictKeys(
            {
              ...conflict.settings,
              env: conflict.settings.env ? { ...conflict.settings.env } : undefined
            },
            conflict.keys
          );
          await saveSettingsFile(conflict.filePath, updatedSettings);
          Logger.success(`已将 ${conflict.filePath} 备份至 '${backupPath}' 并清空冲突变量。`);
        } catch (error) {
          throw new Error(`清理 Claude 设置文件失败: ${error.message}`);
        }
        return true;
      }

      if (answer.action === 'ignore') {
        Logger.warning(`已忽略 ${conflict.filePath} 中的冲突，Claude 可能仍会使用该文件里的旧变量。`);
        return true;
      }

      Logger.info('已取消启动');
      return false;
    } catch (error) {
      throw error;
    }
  }

  async launchProvider(provider, selectedLaunchArgs) {
    try {
      const shouldContinue = await this.ensureClaudeSettingsCompatibility(provider);
      if (!shouldContinue) {
        return;
      }

      this.clearScreen();
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
        const { executeWithEnv } = require('../utils/env-launcher');
        await executeWithEnv(provider, selectedLaunchArgs);

      } catch (error) {
        UIHelper.clearLoadingAnimation(loadingInterval);
        throw error;
      }

    } catch (error) {
      await this.handleError(error, '启动供应商');
    }
  }

  buildLaunchArgs(provider, additionalLaunchArgs = []) {
    const globalDefaultLaunchArgs = this.configManager.getDefaultLaunchArgs();
    const defaultLaunchArgs = Array.isArray(provider?.launchArgs) ? provider.launchArgs : [];
    const extraLaunchArgs = Array.isArray(additionalLaunchArgs) ? additionalLaunchArgs : [];
    return Array.from(new Set([
      ...globalDefaultLaunchArgs,
      ...defaultLaunchArgs,
      ...extraLaunchArgs
    ]));
  }

  getStatusChecker() {
    if (!this.statusChecker) {
      const { ProviderStatusChecker } = require('../utils/provider-status-checker');
      this.statusChecker = new ProviderStatusChecker();
    }
    return this.statusChecker;
  }

  getAvailableLaunchArgs(provider = null) {
    const defaultLaunchArgs = provider
      ? this.buildLaunchArgs(provider)
      : this.configManager.getDefaultLaunchArgs();
    return validator.getAvailableLaunchArgs().map(arg => ({
      ...arg,
      checked: defaultLaunchArgs.includes(arg.name)
    }));
  }

  // getArgDescription 方法已被移除，直接使用 arg.description

  async showProviderSelection() {
    try {
      // 并行加载配置和准备界面
      const providers = await this.configManager.ensureLoaded().then(() => this.configManager.listProviders());

      const initialStatusMap = this._buildInitialStatusMap(providers);
      // 显示欢迎界面（立即渲染）
      this.showWelcomeScreen(providers, initialStatusMap, null);

      if (providers.length === 0) {
        Logger.warning('暂无配置的供应商');
        Logger.info('请先运行 "cc add" 添加供应商配置');
        return;
      }

      const choices = this.createProviderChoices(providers, false, initialStatusMap);

      this.currentPromptContext = 'selection';

      // 异步更新供应商状态，不阻塞界面展示
      if (providers.length > 0) {
        this._startStatusRefresh(providers);
      }

      // 添加特殊选项
      choices.push(
        createSeparator(),
        { name: `${UIHelper.icons.add} 添加新供应商`, value: '__ADD__' },
        { name: `${UIHelper.icons.list} 供应商管理 (编辑/删除)`, value: '__MANAGE__' },
        { name: `${UIHelper.icons.config} 打开配置文件`, value: '__OPEN_CONFIG__' },
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

      const answer = await this.prompt([
        {
          type: 'list',
          name: 'provider',
          message: `请选择要切换的供应商 (总计 ${providers.length} 个):`,
          choices,
          default: defaultChoice,
          pageSize: 12
        }
      ]);

      // 移除 ESC 键监听
      this.removeESCListener(escListener);

      this._cancelStatusRefresh();

      if (answer.provider === '__OPEN_CONFIG__') {
        await this.openConfigFile();
        return await this.showProviderSelection();
      }

      const result = await this.handleSelection(answer.provider);
      this.currentPromptContext = null;
      return result;

    } catch (error) {
      await this.handleError(error, '显示供应商选择');
    } finally {
      if (this.currentPromptContext === 'selection') {
        this.currentPromptContext = null;
      }
      this._cancelStatusRefresh();
    }
  }

  async openConfigFile() {
    const { openCCConfigFile } = require('../utils/config-opener');
    try {
      await openCCConfigFile();
    } catch (err) {
      Logger.error(`打开配置文件失败: ${err.message}`);
    }
  }

  showWelcomeScreen(providers, statusMap = {}, statusError = null) {
    this.clearScreen();

    if (providers.length > 0) {
      console.log(UIHelper.colors.info(`总共 ${providers.length} 个供应商配置`));
    }

    if (statusError) {
      console.log();
      console.log(UIHelper.createCard('状态检测', `检测失败: ${statusError.message}`, UIHelper.icons.warning));
    }

    console.log();
    console.log(UIHelper.createHintLine([
      ['↑ / ↓', '选择供应商'],
      ['Enter', '确认'],
      ['Tab', '切换选项'],
      ['ESC', '退出程序'],
      ['Ctrl+C', '强制退出']
    ]));
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
      case '__EXIT__':
        this.showExitScreen();
        process.exit(0);
      default:
        return await this.showLaunchArgsSelection(selection);
    }
  }

  async showQuickSettings() {
    this.clearScreen();
    console.log(UIHelper.createHintLine([
      ['↑ / ↓', '选择项目'],
      ['Enter', '确认'],
      ['ESC', '返回主菜单']
    ]));
    console.log();
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

    let answer;
    try {
      answer = await this.prompt([
        {
          type: 'list',
          name: 'setting',
          message: '快速设置:',
          choices,
          pageSize: 8
        }
      ]);
    } catch (error) {
      this.removeESCListener(escListener);
      if (this.isEscCancelled(error)) {
        return;
      }
      throw error;
    }

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
    this.clearScreen();
    console.log(UIHelper.createTitle('批量编辑', UIHelper.icons.edit));
    console.log();
    console.log(UIHelper.createTooltip('此功能正在开发中...'));
    console.log();
    console.log(UIHelper.createHintLine([
      ['Enter', '返回上一页'],
      ['ESC', '返回快速设置']
    ]));
    console.log();

    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('返回快速设置');
      this.showQuickSettings();
    }, '返回快速设置');

    try {
      await this.prompt([
        {
          type: 'input',
          name: 'continue',
          message: '按回车键返回...'
        }
      ]);
    } catch (error) {
      this.removeESCListener(escListener);
      if (this.isEscCancelled(error)) {
        return;
      }
      throw error;
    }

    this.removeESCListener(escListener);

    return await this.showQuickSettings();
  }

  async showGlobalSettings() {
    this.clearScreen();
    console.log(UIHelper.createTitle('全局设置', UIHelper.icons.settings));
    console.log();
    console.log(UIHelper.createTooltip('此功能正在开发中...'));
    console.log();
    console.log(UIHelper.createHintLine([
      ['Enter', '返回上一页'],
      ['ESC', '返回快速设置']
    ]));
    console.log();

    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('返回快速设置');
      this.showQuickSettings();
    }, '返回快速设置');

    try {
      await this.prompt([
        {
          type: 'input',
          name: 'continue',
          message: '按回车键返回...'
        }
      ]);
    } catch (error) {
      this.removeESCListener(escListener);
      if (this.isEscCancelled(error)) {
        return;
      }
      throw error;
    }

    this.removeESCListener(escListener);

    return await this.showQuickSettings();
  }

  async showSearchProvider() {
    this.clearScreen();
    console.log(UIHelper.createHintLine([
      ['Enter', '执行搜索'],
      ['ESC', '返回快速设置']
    ]));
    console.log(UIHelper.createTooltip('示例: claude、demo 或供应商别名'));
    console.log();
    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('返回快速设置');
      this.showQuickSettings();
    }, '返回快速设置');

    let answer;
    try {
      answer = await this.prompt([
        {
          type: 'input',
          name: 'search',
          message: '输入供应商名称搜索:',
          validate: input => input.trim() !== '' || '请输入搜索内容'
        }
      ]);
    } catch (error) {
      this.removeESCListener(escListener);
      if (this.isEscCancelled(error)) {
        return;
      }
      throw error;
    }

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
      createSeparator(),
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

    console.log();
    console.log(UIHelper.createHintLine([
      ['↑ / ↓', '选择结果'],
      ['Enter', '查看详情'],
      ['ESC', '返回快速设置']
    ]));

    let result;
    try {
      result = await this.prompt([
        {
          type: 'list',
          name: 'provider',
          message: '搜索结果:',
          choices,
          default: defaultChoice,
          pageSize: 10
        }
      ]);
    } catch (error) {
      this.removeESCListener(escListener2);
      if (this.isEscCancelled(error)) {
        return;
      }
      throw error;
    }

    this.removeESCListener(escListener2);

    if (result.provider === 'back') {
      return await this.showQuickSettings();
    }

    return await this.showProviderDetails(result.provider);
  }

  async showStatistics() {
    await this.configManager.load();
    const providers = this.configManager.listProviders();
    this.clearScreen();

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
    console.log(UIHelper.createHintLine([
      ['Enter', '返回快速设置'],
      ['ESC', '返回快速设置']
    ]));
    console.log();

    // 设置 ESC 键监听
    const escListener = this.createESCListener(() => {
      Logger.info('返回快速设置');
      this.showQuickSettings();
    }, '返回快速设置');

    try {
      await this.prompt([
        {
          type: 'input',
          name: 'continue',
          message: '按回车键继续...'
        }
      ]);
    } catch (error) {
      this.removeESCListener(escListener);
      if (this.isEscCancelled(error)) {
        return;
      }
      throw error;
    }

    this.removeESCListener(escListener);

    return await this.showQuickSettings();
  }

  showExitScreen() {
    this.clearScreen();
    console.log(UIHelper.createTitle('感谢使用', UIHelper.icons.home));
    console.log();
    console.log(UIHelper.colors.info('再见！期待下次使用 🎉'));
    console.log();
  }

  async showHelp() {
    this.clearScreen();
    console.log(UIHelper.createTitle('快捷键帮助', UIHelper.icons.info));
    console.log();

    const sections = [
      {
        title: '通用操作',
        items: [
          UIHelper.createShortcutHint('↑ / ↓', '在选项中移动'),
          UIHelper.createShortcutHint('Enter', '确认/继续'),
          UIHelper.createShortcutHint('ESC', '返回上一层'),
          UIHelper.createShortcutHint('Ctrl+C', '随时强制退出')
        ]
      },
      {
        title: '供应商列表',
        items: [
          UIHelper.createShortcutHint('Tab', '切换特殊选项'),
          UIHelper.createShortcutHint('A', '在启动参数列表中全选'),
          UIHelper.createShortcutHint('I', '在启动参数列表中反选')
        ]
      },
      {
        title: '搜索界面',
        items: [
          UIHelper.createShortcutHint('Enter', '执行搜索或确认结果'),
          UIHelper.createShortcutHint('ESC', '取消搜索返回上一页')
        ]
      }
    ];

    sections.forEach(section => {
      console.log(UIHelper.createCard(section.title, section.items.join('\n'), UIHelper.icons.info));
      console.log();
    });

    const escListener = this.createESCListener(() => {
      Logger.info('返回主菜单');
      this.showProviderSelection();
    }, '返回主菜单');

    console.log(UIHelper.createHintLine([
      ['Enter', '返回主菜单'],
      ['ESC', '返回主菜单']
    ]));
    console.log();

    try {
      await this.prompt([
        {
          type: 'input',
          name: 'continue',
          message: '按回车键返回主菜单'
        }
      ]);
    } catch (error) {
      this.removeESCListener(escListener);
      if (this.isEscCancelled(error)) {
        return;
      }
      throw error;
    }

    this.removeESCListener(escListener);
    return await this.showProviderSelection();
  }

  async showManageMenu() {
    let escListener;
    try {
      await this.configManager.load();
      const providers = this.configManager.listProviders();
      this.clearScreen();
      console.log(UIHelper.createHintLine([
        ['↑ / ↓', '选择供应商或操作'],
        ['Enter', '确认'],
        ['ESC', '返回主菜单']
      ]));
      console.log();

      console.log(UIHelper.createTitle('供应商管理', UIHelper.icons.list));
      console.log();

      if (providers.length === 0) {
        console.log(UIHelper.createCard('提示', '暂无配置的供应商\n请先运行 "cc add" 添加供应商配置', UIHelper.icons.warning));
        return await this.showProviderSelection();
      }

      const statusMap = this._buildInitialStatusMap(providers);
      const choices = this.createProviderChoices(providers, true, statusMap);

      this.currentPromptContext = 'manage';

      if (providers.length > 0) {
        this._startStatusRefresh(providers);
      }

      // 设置 ESC 键监听
      escListener = this.createESCListener(() => {
        Logger.info('返回供应商选择');
        this.showProviderSelection();
      }, '返回供应商选择');

      let answer;
      try {
        answer = await this.prompt([
          {
            type: 'list',
            name: 'action',
            message: `选择供应商或操作 (总计 ${providers.length} 个):`,
            choices,
            pageSize: 12
          }
        ]);
      } catch (error) {
        this.removeESCListener(escListener);
        if (this.isEscCancelled(error)) {
          return;
        }
        throw error;
      }

      this.removeESCListener(escListener);

      this._cancelStatusRefresh();

      const result = await this.handleManageAction(answer.action);
      this.currentPromptContext = null;
      return result;

    } catch (error) {
      await this.handleError(error, '显示供应商管理');
    } finally {
      if (this.currentPromptContext === 'manage') {
        this.currentPromptContext = null;
      }
      this._cancelStatusRefresh();
    }
  }

  createProviderChoices(providers, includeActions = false, statusMap = {}) {
    const lastUsedProvider = providers.reduce((latest, current) => {
      if (!current || !current.lastUsed) {
        return latest;
      }
      if (!latest || !latest.lastUsed) {
        return current;
      }
      return new Date(current.lastUsed) > new Date(latest.lastUsed) ? current : latest;
    }, null);

    const choices = providers.map(provider => {
      const isLastUsed = lastUsedProvider && lastUsedProvider.name === provider.name;
      const availability = statusMap[provider.name];
      const icon = this._iconForState(availability?.state);
      const statusText = this._formatAvailability(availability);
      const statusLabel = chalk.gray('-') + ' ' + statusText;
      const label = `${icon} ${UIHelper.formatProvider(provider)}${isLastUsed ? UIHelper.colors.muted(' --- 上次使用') : ''} ${statusLabel}`;

      return {
        name: label,
        value: provider.name,
        short: provider.name
      };
    });

    if (includeActions) {
      choices.push(
        createSeparator(),
        { name: `${UIHelper.icons.back} 返回供应商选择`, value: 'back' },
        { name: `${UIHelper.icons.error} 退出`, value: 'exit' }
      );
    }

    return choices;
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
    if (state === 'pending') {
      return '⏳';
    }
    return '⚪';
  }

  _formatAvailability(availability) {
    if (!availability) {
      return chalk.gray('测试中...');
    }
    if (availability.state === 'online') {
      return chalk.green(availability.label || '可用');
    }
    if (availability.state === 'degraded') {
      return chalk.yellow(availability.label || '有限可用');
    }
    if (availability.state === 'offline') {
      return chalk.red(availability.label || '不可用');
    }
    if (availability.state === 'pending') {
      return chalk.gray(availability.label || '测试中...');
    }
    return chalk.gray(availability.label || '未知');
  }

  _buildInitialStatusMap(providers) {
    const cached = this.latestStatusMap || {};
    const map = {};
    providers.forEach(provider => {
      map[provider.name] = cached[provider.name] || {
        state: 'pending',
        label: '测试中...',
        latency: null
      };
    });
    return map;
  }

  _buildErrorStatusMap(providers, error) {
    const message = error ? `检测失败: ${error.message}` : '检测失败';
    const map = {};
    providers.forEach(provider => {
      map[provider.name] = {
        state: 'offline',
        label: message,
        latency: null
      };
    });
    return map;
  }

  _startStatusRefresh(providers) {
    this._cancelStatusRefresh();

    const refreshToken = Symbol('statusRefresh');
    this.activeStatusRefresh = refreshToken;
    this.lastStatusRenderSignature = null;

    const latestMap = { ...this.latestStatusMap };
    this.getStatusChecker()
      .checkAllStreaming(providers, (providerName, status) => {
        if (this.activeStatusRefresh !== refreshToken) {
          return;
        }
        latestMap[providerName] = status;
        this.latestStatusMap = latestMap;
        this._queueStatusUpdate(providerName, status, refreshToken, providers);
      })
      .then(finalMap => {
        if (this.activeStatusRefresh !== refreshToken) {
          return;
        }
        this.latestStatusMap = finalMap;
      })
      .catch(error => {
        if (this.activeStatusRefresh !== refreshToken) {
          return;
        }
        if (!this.activePrompt) {
          Logger.error(`供应商状态检测失败: ${error.message}`);
        }
        const fallback = this._buildErrorStatusMap(providers, error);
        Object.assign(latestMap, fallback);
        this.latestStatusMap = latestMap;
        this._applyStatusUpdate(providers, fallback, error, refreshToken);
      });
  }

  _cancelStatusRefresh() {
    this.activeStatusRefresh = null;
    this.lastStatusRenderSignature = null;
    if (this.statusFlushTimer) {
      clearTimeout(this.statusFlushTimer);
      this.statusFlushTimer = null;
    }
    this.pendingStatusUpdates.clear();
  }

  _queueStatusUpdate(providerName, status, refreshToken, providers) {
    if (refreshToken && this.activeStatusRefresh !== refreshToken) {
      return;
    }
    this.pendingStatusUpdates.set(providerName, status);
    if (this.statusFlushTimer) {
      return;
    }
    this.statusFlushTimer = setTimeout(() => {
      this._flushStatusUpdates(refreshToken, providers);
    }, this.statusFlushDelayMs);
  }

  _flushStatusUpdates(refreshToken, providers) {
    if (this.statusFlushTimer) {
      clearTimeout(this.statusFlushTimer);
      this.statusFlushTimer = null;
    }
    if (refreshToken && this.activeStatusRefresh !== refreshToken) {
      this.pendingStatusUpdates.clear();
      return;
    }
    if (this.pendingStatusUpdates.size === 0) {
      return;
    }
    const statusMap = { ...this.latestStatusMap };
    this.pendingStatusUpdates.clear();
    this._applyStatusUpdate(providers, statusMap, null, refreshToken);
  }

  _applyStatusUpdate(providers, statusMap, error, refreshToken = null) {
    if (refreshToken && this.activeStatusRefresh !== refreshToken) {
      return;
    }
    if (this.currentPromptContext !== 'selection' && this.currentPromptContext !== 'manage') {
      return;
    }

    const activePrompt = this.activePrompt?.promise?.ui?.activePrompt;
    if (!activePrompt || activePrompt.status === 'answered') {
      return;
    }

    const includeActions = this.currentPromptContext === 'manage';
    const updatedChoicesBase = this.createProviderChoices(providers, includeActions, statusMap);
    const updatedChoices = [...updatedChoicesBase];

    if (!includeActions) {
      updatedChoices.push(
        createSeparator(),
        { name: `${UIHelper.icons.add} 添加新供应商`, value: '__ADD__' },
        { name: `${UIHelper.icons.list} 供应商管理 (编辑/删除)`, value: '__MANAGE__' },
        { name: `${UIHelper.icons.config} 打开配置文件`, value: '__OPEN_CONFIG__' },
        { name: `${UIHelper.icons.error} 退出`, value: '__EXIT__' }
      );
    }

    const nextMessage = (() => {
      if (error) {
        if (this.currentPromptContext === 'selection') {
          return `请选择要切换的供应商 (总计 ${providers.length} 个，状态检测失败，使用默认配置):`;
        }
        if (this.currentPromptContext === 'manage') {
          return `选择供应商或操作 (总计 ${providers.length} 个，状态检测失败，使用默认配置):`;
        }
      }

      if (this.currentPromptContext === 'selection') {
        return `请选择要切换的供应商 (总计 ${providers.length} 个):`;
      }
      if (this.currentPromptContext === 'manage') {
        return `选择供应商或操作 (总计 ${providers.length} 个):`;
      }
      return activePrompt.opt.message;
    })();

    const renderSignature = [
      this.currentPromptContext,
      nextMessage,
      ...updatedChoices.map(choice => {
        if (choice && choice.type === 'separator') {
          return '---';
        }
        return `${choice?.value || ''}:${choice?.name || ''}`;
      })
    ].join('|');

    if (renderSignature === this.lastStatusRenderSignature) {
      return;
    }
    this.lastStatusRenderSignature = renderSignature;

    const previousValue = (() => {
      try {
        return activePrompt.opt.choices?.getChoice(activePrompt.selected)?.value ?? null;
      } catch (err) {
        return null;
      }
    })();

    const Choices = getChoices();
    activePrompt.opt.choices = new Choices(updatedChoices, activePrompt.answers);

    if (previousValue != null) {
      const newIndex = activePrompt.opt.choices.realChoices.findIndex(choice => choice.value === previousValue);
      if (newIndex >= 0) {
        activePrompt.selected = newIndex;
      } else if (activePrompt.selected >= activePrompt.opt.choices.realLength) {
        activePrompt.selected = Math.max(activePrompt.opt.choices.realLength - 1, 0);
      }
    } else if (activePrompt.selected >= activePrompt.opt.choices.realLength) {
      activePrompt.selected = Math.max(activePrompt.opt.choices.realLength - 1, 0);
    }

    activePrompt.opt.message = nextMessage;

    activePrompt.render();
  }

  async handleManageAction(action) {
    switch (action) {
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

  async showProviderDetails(providerName) {
    let escListener;
    try {
      const provider = await this.validateProvider(providerName);
      this.clearScreen();

      console.log(UIHelper.createTitle('供应商详情', UIHelper.icons.info));
      console.log();
      console.log(UIHelper.createHintLine([
        ['↑ / ↓', '选择操作'],
        ['Enter', '确认'],
        ['ESC', '返回管理列表']
      ]));
      console.log();

      const details = [
        ['供应商名称', provider.name],
        ['显示名称', provider.displayName],
        ['认证模式', provider.authMode === 'oauth_token' ? 'OAuth令牌模式' : 'API密钥模式'],
        ['基础URL', provider.baseUrl || (provider.authMode === 'oauth_token' ? '✨ 官方默认服务器' : '⚠️ 未设置')],
        ['认证令牌', provider.authToken || '未设置'],
        ['Opus 模型', provider.models?.opus || '未设置'],
        ['Sonnet 模型', provider.models?.sonnet || '未设置'],
        ['Haiku 模型', provider.models?.haiku || '未设置'],
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
      escListener = this.createESCListener(() => {
        Logger.info('返回管理列表');
        this.showManageMenu();
      }, '返回管理列表');

      let answer;
      try {
        answer = await this.prompt([
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
      } catch (error) {
        this.removeESCListener(escListener);
        if (this.isEscCancelled(error)) {
          return;
        }
        throw error;
      }

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
    let escListener;
    try {
      await this.configManager.load();
      let provider = this.configManager.getProvider(providerName);
      this.clearScreen();

      if (!provider) {
        Logger.error(`供应商 '${providerName}' 不存在`);
        return await this.showManageMenu();
      }

      // 设置 ESC 键监听
      escListener = this.createESCListener(() => {
        Logger.info('取消编辑供应商');
        this.showManageMenu();
      }, '取消编辑');

      let answers;
      try {
        answers = await this.prompt([
          {
            type: 'input',
            name: 'name',
            message: '请输入供应商名称 (用于命令行):',
            default: provider.name,
            validate: (input) => {
              const error = validator.validateName(input);
              if (error) return error;
              return true;
            }
          },
          {
            type: 'input',
            name: 'displayName',
            message: '显示名称:',
            default: provider.displayName,
            prefillDefault: true
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
            prefillDefault: true,
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
            default: provider.authToken,
            prefillDefault: true
          },
          {
            type: 'input',
            name: 'opusModel',
            message: 'Opus 模型 (ANTHROPIC_DEFAULT_OPUS_MODEL):',
            default: provider.models?.opus || '',
            prefillDefault: true,
            allowEmpty: true,
            validate: (input) => {
              const error = validator.validateModel(input);
              if (error) return error;
              return true;
            }
          },
          {
            type: 'input',
            name: 'sonnetModel',
            message: 'Sonnet 模型 (ANTHROPIC_DEFAULT_SONNET_MODEL):',
            default: provider.models?.sonnet || '',
            prefillDefault: true,
            allowEmpty: true,
            validate: (input) => {
              const error = validator.validateModel(input);
              if (error) return error;
              return true;
            }
          },
          {
            type: 'input',
            name: 'haikuModel',
            message: 'Haiku 模型 (ANTHROPIC_DEFAULT_HAIKU_MODEL):',
            default: provider.models?.haiku || '',
            prefillDefault: true,
            allowEmpty: true,
            validate: (input) => {
              const error = validator.validateModel(input);
              if (error) return error;
              return true;
            }
          },
          {
            type: 'input',
            name: 'autoCompactWindow',
            message: '上下文窗口 token 容量 (CLAUDE_CODE_AUTO_COMPACT_WINDOW):',
            default: provider.runtimeEnv?.autoCompactWindow || DEFAULT_RUNTIME_ENV.autoCompactWindow,
            prefillDefault: true,
            validate: (input) => {
              const error = validator.validatePositiveInteger(input, '上下文窗口 token 容量');
              if (error) return error;
              return true;
            }
          },
          {
            type: 'input',
            name: 'autoCompactPctOverride',
            message: '自动压缩触发百分比 (CLAUDE_AUTOCOMPACT_PCT_OVERRIDE):',
            default: provider.runtimeEnv?.autoCompactPctOverride || DEFAULT_RUNTIME_ENV.autoCompactPctOverride,
            prefillDefault: true,
            validate: (input) => {
              const error = validator.validatePercent(input, '自动压缩触发百分比');
              if (error) return error;
              return true;
            }
          },
          {
            type: 'input',
            name: 'bashMaxOutputLength',
            message: 'Bash 最大输出长度 (BASH_MAX_OUTPUT_LENGTH):',
            default: provider.runtimeEnv?.bashMaxOutputLength || DEFAULT_RUNTIME_ENV.bashMaxOutputLength,
            prefillDefault: true,
            validate: (input) => {
              const error = validator.validatePositiveInteger(input, 'Bash 最大输出长度');
              if (error) return error;
              return true;
            }
          },
          {
            type: 'input',
            name: 'taskMaxOutputLength',
            message: 'Task 最大输出长度 (TASK_MAX_OUTPUT_LENGTH):',
            default: provider.runtimeEnv?.taskMaxOutputLength || DEFAULT_RUNTIME_ENV.taskMaxOutputLength,
            prefillDefault: true,
            validate: (input) => {
              const error = validator.validatePositiveInteger(input, 'Task 最大输出长度');
              if (error) return error;
              return true;
            }
          }
        ]);
      } catch (error) {
        this.removeESCListener(escListener);
        if (this.isEscCancelled(error)) {
          return;
        }
        throw error;
      }

      const originalName = provider.name;
      const newName = answers.name;

      // 处理重命名逻辑
      if (newName !== originalName) {
        await this.configManager.ensureLoaded();
        const providersMap = this.configManager.config.providers;

        if (providersMap[newName] && providersMap[newName] !== provider) {
          Logger.error(`供应商名称 '${newName}' 已存在，请使用其他名称`);
          return await this.showManageMenu();
        }

        providersMap[newName] = {
          ...provider,
          name: newName
        };

        delete providersMap[originalName];

        if (this.configManager.config.currentProvider === originalName) {
          this.configManager.config.currentProvider = newName;
          providersMap[newName].current = true;
        }

        provider = providersMap[newName];
      }

      // 更新供应商配置
      provider.displayName = answers.displayName || newName;
      provider.baseUrl = answers.baseUrl;
      provider.authToken = answers.authToken;
      provider.authMode = answers.authMode;

      // 更新模型配置
      if (!provider.models) {
        provider.models = {};
      }
      provider.models.opus = answers.opusModel || null;
      provider.models.sonnet = answers.sonnetModel || null;
      provider.models.haiku = answers.haikuModel || null;
      provider.runtimeEnv = {
        autoCompactWindow: Number(answers.autoCompactWindow),
        autoCompactPctOverride: Number(answers.autoCompactPctOverride),
        bashMaxOutputLength: Number(answers.bashMaxOutputLength),
        taskMaxOutputLength: Number(answers.taskMaxOutputLength)
      };

      await this.configManager.save();
      Logger.success(`供应商 '${newName}' 已更新`);

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
    let escListener;
    try {
      await this.configManager.load();
      const provider = this.configManager.getProvider(providerName);
      this.clearScreen();

      if (!provider) {
        Logger.error(`供应商 '${providerName}' 不存在`);
        return await this.showManageMenu();
      }

      // 设置 ESC 键监听
      escListener = this.createESCListener(() => {
        Logger.info('取消删除供应商');
        this.showManageMenu();
      }, '取消删除');

      let confirm;
      try {
        confirm = await this.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `确定要删除供应商 '${providerName}' 吗?`,
            default: false
          }
        ]);
      } catch (error) {
        this.removeESCListener(escListener);
        if (this.isEscCancelled(error)) {
          return;
        }
        throw error;
      }

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

async function switchCommand(providerName, additionalLaunchArgs = []) {
  const switcher = new EnvSwitcher();

  try {
    if (providerName) {
      const provider = await switcher.validateProvider(providerName);
      const launchArgs = switcher.buildLaunchArgs(provider, additionalLaunchArgs);
      await switcher.launchProvider(provider, launchArgs);
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
